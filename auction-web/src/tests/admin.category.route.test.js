import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";

let mockSession = () => (req, res, next) => {
  req.session = req.session || {};
  next();
};

const mockCategoryModel = {
  findAll: jest.fn().mockResolvedValue([]),
  findByCategoryId: jest.fn().mockResolvedValue({ id: 1, name: "Cat 1" }),
  findLevel1Categories: jest.fn().mockResolvedValue([]),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  isCategoryHasProducts: jest.fn()
};
jest.unstable_mockModule("../models/category.model.js", () => mockCategoryModel);

const adminCategoryRouter = (await import("../routes/admin/category.route.js")).default;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((req, res, next) => mockSession()(req, res, next));
app.use((req, res, next) => {
  res.render = (view, options) => {
    res.status(200).json({ view, options });
  };
  next();
});

app.use("/admin/categories", adminCategoryRouter);

describe("Integration Tests: /admin/categories/* (Flow 8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("IT-ADM-CAT-01: GET /list admin viewing category list", async () => {
    const mockCategories = [{ id: 1, name: "Electronics" }];
    mockCategoryModel.findAll.mockResolvedValueOnce(mockCategories);

    const response = await request(app).get("/admin/categories/list");
    expect(response.status).toBe(200);
    expect(response.body.view).toBe("vwAdmin/category/list");
    expect(response.body.options.categories).toEqual(mockCategories);
  });

  test("IT-ADM-CAT-02: POST /add creates a category", async () => {
    mockCategoryModel.createCategory.mockResolvedValueOnce();

    const response = await request(app).post("/admin/categories/add").send({
      name: "New Cat", parent_id: 1
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/categories/list");
    expect(mockCategoryModel.createCategory).toHaveBeenCalledWith({ name: "New Cat", parent_id: 1 });
  });

  test("IT-ADM-CAT-03: POST /edit updates a category", async () => {
    mockCategoryModel.updateCategory.mockResolvedValueOnce();

    const response = await request(app).post("/admin/categories/edit").send({
      id: 1, name: "Updated Cat", parent_id: ""
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/categories/list");
    expect(mockCategoryModel.updateCategory).toHaveBeenCalled();
  });

  test("IT-ADM-CAT-04: POST /delete removes a category without products", async () => {
    mockCategoryModel.isCategoryHasProducts.mockResolvedValueOnce(false);
    mockCategoryModel.deleteCategory.mockResolvedValueOnce();

    const response = await request(app).post("/admin/categories/delete").send({ id: 1 });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/categories/list");
    expect(mockCategoryModel.deleteCategory).toHaveBeenCalledWith(1);
  });

  test("IT-ADM-CAT-05: POST /delete fails to remove category with products", async () => {
    mockCategoryModel.isCategoryHasProducts.mockResolvedValueOnce(true);

    const response = await request(app).post("/admin/categories/delete").send({ id: 1 });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/categories/list");
    expect(mockCategoryModel.deleteCategory).not.toHaveBeenCalled();
  });
});
