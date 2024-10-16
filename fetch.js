const { IgApiClient } = require("instagram-private-api");
const mongoose = require("mongoose");
require("dotenv").config({ path: "./.env" });

const Post = require("./src/models/posts"); // MongoDB schema for Post

const igA = new IgApiClient(); // For Account A

const {
	IG_USERNAME_A, // Account A username
	IG_PASSWORD_A, // Account A password
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

// Login function for Account A
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

// Fetch posts from Account A with pagination
const fetchPostsFromAccountA = async (username) => {
	try {
		const userA = await igA.user.searchExact(username);
		const userIdA = userA.pk;

		const feed = igA.feed.user(userIdA); // Feed instance
		let moreAvailable = true; // To check if more posts are available
		let pageCount = 0; // Counter for pages fetched

		// Fetch posts while more are available
		while (moreAvailable) {
			const posts = await feed.items(); // Fetch a page of posts

			for (const post of posts) {
				let mediaLinks = [];

				// Handle different post types (photo, video, or album)
				if (post.media_type === 8 && post.carousel_media) {
					// Carousel (album) post
					mediaLinks = post.carousel_media
						.map((item) => {
							// Filter for images/videos that do NOT have width of 360
							if (item.media_type === 1) {
								return item.image_versions2?.candidates.find(
									(candidate) => candidate.width !== 360, // Exclude candidates with width 360
								)?.url;
							// biome-ignore lint/style/noUselessElse: <explanation>
							} else if (item.media_type === 2) {
								return item.video_versions?.find(
									(video) => video.width !== 360, // Exclude videos with width 360
								)?.url;
							}
						})
						.filter((link) => link); // Remove undefined/null values
				} else if (post.media_type === 1) {
					// Photo post
					const photoUrl = post.image_versions2?.candidates.find(
						(candidate) => candidate.width !== 360, // Exclude candidates with width 360
					)?.url;
					if (photoUrl) mediaLinks.push(photoUrl);
				} else if (post.media_type === 2) {
					// Video post
					const videoUrl = post.video_versions?.find(
						(video) => video.width !== 360, // Exclude videos with width 360
					)?.url;
					if (videoUrl) mediaLinks.push(videoUrl);
				}

				const postData = {
					type:
						post.media_type === 1
							? "photo"
							: post.media_type === 2
								? "video"
								: "album",
					likes: post.like_count,
					comments: post.comment_count,
					links: mediaLinks.filter((link) => link), // Filter out undefined/null links
					caption: post.caption?.text || "",
				};

				const newPost = new Post(postData);
				await newPost.save();
				console.log(`Saved post from Account A with ${postData.likes} likes`);

				// Introduce a delay after saving each post
				await delay(3000); // Delay for 3 seconds before fetching the next post
			}

			// Increment page counter and check for more posts
			pageCount++;
			console.log(`Fetched page ${pageCount} of posts`);

			// Check if more posts are available
			moreAvailable = feed.isMoreAvailable();
			if (!moreAvailable) {
				console.log("No more posts available to fetch.");
			}
		}

		return; // Done fetching posts
	} catch (error) {
		console.error("Failed to fetch posts from Account A: ", error);
	}
};

// Main function to handle the fetching of posts
const main = async () => {
	await connectToDb(); // Connect to MongoDB
	await loginToInstagram(igA, IG_USERNAME_A, IG_PASSWORD_A); // Log in to Account A

	await fetchPostsFromAccountA(IG_USERNAME_A); // Fetch posts from Account A
};

// Execute the main function
main().catch(console.error);
