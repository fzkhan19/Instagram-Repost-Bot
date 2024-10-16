const mongoose = require("mongoose");

const travelSchema = new mongoose.Schema(
	{
		type: {
			type: String,
		},
		likes: {
			type: Number,
		},
		comments: {
			type: Number,
		},
		links: [],
		caption: {
			type: String,
		},
		reposted: {
			type: Boolean,
			default: false, // New posts are not reposted by default
		},
	},
	{
		timestamps: true,
	},
);

module.exports = mongoose.model("Posts", travelSchema);
