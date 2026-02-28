import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";

let mockSession = () => (req, res, next) => {
  req.session = req.session || {};
  next();
};

const mockProductModel = {
  findAll: jest.fn().mockResolvedValue([]),
  findByProductIdForAdmin: jest.fn().mockResolvedValue({ id: 1 }),
  updateProduct: jest.fn().mockResolvedValue(),
  deleteProduct: jest.fn().mockResolvedValue()
};
jest.unstable_mockModule("../models/product.model.js", () => mockProductModel);

const mockAdminProductService = {
  createProductWithImages: jest.fn().mockResolvedValue([1])
};
jest.unstable_mockModule("../services/admin.product.service.js", () => mockAdminProductService);

const mockUserModel = {
  findUsersByRole: jest.fn().mockResolvedValue([{ id: 2, fullname: "Seller" }])
};
jest.unstable_mockModule("../models/user.model.js", () => mockUserModel);

// Mock fs and multer
jest.unstable_mockModule("fs", () => ({ default: { renameSync: jest.fn() } }));
jest.unstable_mockModule("multer", () => {
  return {
    default: Object.assign(
      (opt) => ({
        single: () => (req, res, next) => next(),
        array: () => (req, res, next) => next()
      }),
      { diskStorage: jest.fn() }
    )
  }
});

const adminProductRouter = (await import("../routes/admin/product.route.js")).default;
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

app.use("/admin/products", adminProductRouter);

describe("Integration Tests: /admin/products/* (Flow 8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("IT-ADM-PRD-01: GET /list admin viewing product list", async () => {
    mockProductModel.findAll.mockResolvedValueOnce([{ id: 1, name: "Product 1" }]);

    const response = await request(app).get("/admin/products/list");
    expect(response.status).toBe(200);
    expect(response.body.view).toBe("vwAdmin/product/list");
    expect(response.body.options.products).toHaveLength(1);
  });

  test("IT-ADM-PRD-02: POST /add creates a product and renames files", async () => {
    const response = await request(app).post("/admin/products/add").send({
      name: "New Product",
      seller_id: 2,
      category_id: 1,
      start_price: "100,000",
      step_price: "10,000",
      buy_now_price: "",
      created_at: new Date().toISOString(),
      end_date: new Date().toISOString(),
      thumbnail: "thumb.jpg",
      imgs_list: JSON.stringify(["img1.jpg", "img2.jpg"])
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/products/list");
    expect(mockAdminProductService.createProductWithImages).toHaveBeenCalled();
  });

  test("IT-ADM-PRD-03: POST /edit updates a product", async () => {
    const response = await request(app).post("/admin/products/edit").send({
      id: 1, name: "Updated Product"
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/products/list");
    expect(mockProductModel.updateProduct).toHaveBeenCalled();
  });

  test("IT-ADM-PRD-04: POST /delete removes a product", async () => {
    const response = await request(app).post("/admin/products/delete").send({ id: 1 });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/products/list");
    expect(mockProductModel.deleteProduct).toHaveBeenCalledWith(1);
  });
});
