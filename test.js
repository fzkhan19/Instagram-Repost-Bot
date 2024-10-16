const { IgApiClient } = require("instagram-private-api");
require("dotenv").config({ path: "./.env" });

const igA = new IgApiClient(); // For Account A
const igB = new IgApiClient(); // For Account B

const {
  IG_USERNAME_A, // Account A username
  IG_PASSWORD_A, // Account A password
  IG_USERNAME_B, // Account B username
  IG_PASSWORD_B, // Account B password
} = process.env;

// Login function for a specific account
const loginToInstagram = async (igClient, username, password) => {
  try {
    igClient.state.generateDevice(username);
    await igClient.account.login(username, password);
    console.log(`Successfully logged in as ${username}`);
  } catch (err) {
    console.error(`Failed to log in as ${username}: `, err);
  }
};

// Main function to test the login
const testLogin = async () => {
  await loginToInstagram(igA, IG_USERNAME_A, IG_PASSWORD_A); // Log in to Account A
  await loginToInstagram(igB, IG_USERNAME_B, IG_PASSWORD_B); // Log in to Account B
};

// Run the login test
testLogin();
