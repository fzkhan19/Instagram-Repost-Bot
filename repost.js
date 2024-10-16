const { IgApiClient } = require("instagram-private-api");
const axios = require("axios");
const mongoose = require("mongoose");
const cron = require("cron");
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

// Generate random delay between 30 and 120 seconds
const randomDelay = () => {
	const minDelay = 30 * 1000; // 30 seconds
	const maxDelay = 120 * 1000; // 120 seconds
	return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
};

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

// Repost content to Account B
const repostToAccountB = async (limit = 20) => {
	let skip = 0;

	const posts = await Post.find().limit(limit).skip(skip).sort({ likes: -1 });

	if (posts.length === 0) {
		console.log("No more posts to repost.");
		return; // Exit function if no more posts are found
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

				// Log album details for debugging
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
		} catch (error) {
			console.error("Failed to repost on Account B: ", error);
		}

		// Introduce a random delay after each repost
		const delayTime = randomDelay();
		await delay(delayTime);
		console.log(`Waiting for ${delayTime / 1000} seconds before next repost.`);
	}

	skip += limit; // Move to the next set of posts
};

// Main function to handle the reposting
const main = async () => {
	await connectToDb(); // Connect to MongoDB
	await loginToInstagram(igB, IG_USERNAME_B, IG_PASSWORD_B); // Log in to Account B

	// Set up a cron job to run every hour at random minutes
	const job = new cron.CronJob({
		cronTime: '0 * * * *', // Runs at the start of every hour
		onTick: async () => {
			const randomMinute = Math.floor(Math.random() * 60);
			const randomHour = Math.floor(Math.random() * 24);
			const cronTime = `${randomMinute} ${randomHour} * * *`;

			console.log(`Scheduled posting at ${randomMinute}:${randomHour}`);
			await repostToAccountB(); // Repost to Account B
		},
		start: true,
		timeZone: 'America/New_york', // Change to your timezone (e.g., 'America/New_York')
	});

	job.start();
};

// Execute the main function
main().catch(console.error);
