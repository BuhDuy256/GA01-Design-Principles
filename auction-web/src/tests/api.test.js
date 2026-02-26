import request from "supertest";
import express from "express";

// Create a simple Express app for testing purposes
// In a real scenario, you would export your app from index.js and import it here
const app = express();
app.get("/api/test", (req, res) => {
  res.status(200).json({ message: "success" });
});

describe("API Integration tests", () => {
  test("GET /api/test should return 200 and success message", async () => {
    const response = await request(app).get("/api/test");
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("success");
  });
});
