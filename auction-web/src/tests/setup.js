// Test setup configuration
import { jest } from "@jest/globals";

// Set environment variables for testing BEFORE any imports
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-secret-key";
process.env.RECAPTCHA_SITE_KEY = "test-site-key";
process.env.RECAPTCHA_SECRET_KEY = "test-secret-key";

// OAuth environment variables
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.GOOGLE_CALLBACK_URL =
  "http://localhost:3005/account/auth/google/callback";

process.env.FACEBOOK_APP_ID = "test-facebook-app-id";
process.env.FACEBOOK_APP_SECRET = "test-facebook-app-secret";
process.env.FACEBOOK_CALLBACK_URL =
  "http://localhost:3005/account/auth/facebook/callback";

process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.GITHUB_CALLBACK_URL =
  "http://localhost:3005/account/auth/github/callback";

// Database environment variables
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "5432";
process.env.DB_NAME = "test_auction_db";
process.env.DB_USER = "test_user";
process.env.DB_PASSWORD = "test_password";

// Mock mailer to prevent sending real emails during tests
jest.mock("../utils/mailer.js", () => ({
  sendMail: jest.fn().mockResolvedValue(true),
}));

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Close database connections, etc.
  await new Promise((resolve) => setTimeout(resolve, 500));
});
