const { IgApiClient } = require("instagram-private-api");
const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config({ path: "./.env" });

const Post = require("./src/models/posts"); // MongoDB schema for Post

const igB = new IgApiClient(); // For Account B

const {
	IG_USERNAME_B, // Account B username
	IG_PASSWORD_B, // Account B password
	MONGO_URL,
} = process.env;

// Connect to MongoDB
const connectToDb = async () => {
	await mongoose
		.connect(MONGO_URL, {
			useUnifiedTopology: true,
			useNewUrlParser: true,
			serverSelectionTimeoutMS: 5000,
		})
		.then(() => console.log("DB CONNECTED SUCCESS"))
		.catch((error) => {
			console.log("DB CONNECTION FAILED", error);
			process.exit(1);
		});
};

// Login function for Account B
const loginToInstagram = async (igClient, username, password) => {
	try {
		igClient.state.generateDevice(username);
		await igClient.account.login(username, password);
		console.log(`Logged in as ${username}`);
	} catch (err) {
		console.error(`Failed to log in as ${username}: `, err);
	}
};

// Delay function to introduce a wait time
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to fetch media buffers
const fetchMediaBuffers = async (links) => {
	try {
		const mediaPromises = links.map((link) =>
			axios.get(link, { responseType: "arraybuffer" }),
		);
		const mediaBuffers = await Promise.all(mediaPromises);

		// Log the media file details for debugging
		mediaBuffers.forEach((buffer, index) => {
			console.log(`Media ${index + 1} - Size: ${buffer.length} bytes`);
		});

		return mediaBuffers.map((res) => res.data);
	} catch (error) {
		console.error("Error fetching media buffers: ", error);
		throw error; // Rethrow to handle higher up
	}
};

// Repost content to Account B with random delay and avoiding duplicates
const repostToAccountB = async (skip) => {
	const limit = 20; // Number of posts to fetch per request
	while (true) {
		// Fetch only posts that haven't been reposted
		const posts = await Post.find({ reposted: { $ne: true } })
			.limit(limit)
			.skip(skip)
			.sort({ likes: -1 });

		if (posts.length === 0) {
			console.log("No more posts to repost.");
			break; // Exit loop if no more posts are found
		}

		for (const post of posts) {
			try {
				const mediaBuffers = await fetchMediaBuffers(post.links);

				if (post.type === "video") {
					// Repost as a video
					await igB.publish.video({
						file: mediaBuffers[0],
						caption: post.caption,
					});
				} else if (post.type === "album" && mediaBuffers.length > 1) {
					// Create items array for album (carousel post)
					const albumItems = mediaBuffers.map((buffer, index) => ({
						file: buffer,
						// Check if the item is a video or photo based on link extension
						type: post.links[index].endsWith(".mp4") ? "video" : "photo",
					}));

					console.log(`Posting album with ${albumItems.length} items`);

					// Repost as an album
					await igB.publish.album({
						items: albumItems,
						caption: post.caption,
					});
				} else {
					// Repost as a photo
					await igB.publish.photo({
						file: mediaBuffers[0],
						caption: post.caption,
					});
				}

				console.log(`Reposted successfully on Account B: ${post.caption}`);

				// Mark the post as reposted
				await Post.updateOne({ _id: post._id }, { reposted: true });
			} catch (error) {
				console.error("Failed to repost on Account B: ", error);
			}

			// Introduce a random delay (between 30s and 120s) after each repost
			const randomDelay = Math.floor(Math.random() * (120000 - 30000) + 30000);
			await delay(randomDelay);
		}
	}
};

// Main function to handle the reposting
const main = async () => {
	await connectToDb(); // Connect to MongoDB
	await loginToInstagram(igB, IG_USERNAME_B, IG_PASSWORD_B); // Log in to Account B
	let skip = 0; // Skip value for pagination
	await repostToAccountB(skip); // Repost to Account B
	skip += 20;
};

// Execute the main function
main().catch(console.error);
