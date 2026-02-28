import { jest } from "@jest/globals";

const mockKnex = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  first: jest.fn(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  andOnVal: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  clone: jest.fn().mockReturnThis()
};

const dbFn = jest.fn(() => mockKnex);
dbFn.raw = jest.fn((str) => str);
jest.unstable_mockModule("../utils/db.js", () => ({ default: dbFn }));

const productModel = await import("../models/product.model.js");

describe("Unit Tests: product.model.js (Admin - Flow 8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("UT-ADM-PRD-01: findAll() should return all products", async () => {
    mockKnex.select.mockResolvedValueOnce([{ id: 1, name: "Product A" }]);

    const result = await productModel.findAll();

    expect(dbFn).toHaveBeenCalledWith("products");
    expect(mockKnex.leftJoin).toHaveBeenCalledTimes(2);
    expect(mockKnex.select).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1, name: "Product A" }]);
  });

  test("UT-ADM-PRD-02: findByProductIdForAdmin(id) should return product details", async () => {
    const mockRows = [{
      id: 1, name: "Product A", img_link: "/path/img1.jpg", thumbnail: "/path/thumb.jpg"
    }];
    mockKnex.select.mockResolvedValueOnce(mockRows);

    const result = await productModel.findByProductIdForAdmin(1, 99);

    expect(dbFn).toHaveBeenCalledWith("products");
    expect(mockKnex.where).toHaveBeenCalledWith("products.id", 1);
    expect(result.id).toBe(1);
    expect(result.sub_images).toEqual(["/path/img1.jpg"]);
  });

  test("UT-ADM-PRD-03: addProduct(productData) should insert a product", async () => {
    mockKnex.returning.mockResolvedValueOnce([{ id: 1 }]);

    const result = await productModel.addProduct({ name: "New Product" });

    expect(dbFn).toHaveBeenCalledWith("products");
    expect(mockKnex.insert).toHaveBeenCalledWith({ name: "New Product" });
    expect(result).toEqual([{ id: 1 }]);
  });

  test("UT-ADM-PRD-04: updateProduct(id, data) should update product details", async () => {
    mockKnex.update.mockResolvedValueOnce(1);

    const result = await productModel.updateProduct(1, { name: "Updated" });

    expect(dbFn).toHaveBeenCalledWith("products");
    expect(mockKnex.where).toHaveBeenCalledWith("id", 1);
    expect(mockKnex.update).toHaveBeenCalledWith({ name: "Updated" });
    expect(result).toBe(1);
  });

  test("UT-ADM-PRD-05: deleteProduct(id) should remove a product", async () => {
    mockKnex.del.mockResolvedValueOnce(1);

    const result = await productModel.deleteProduct(1);

    expect(dbFn).toHaveBeenCalledWith("products");
    expect(mockKnex.where).toHaveBeenCalledWith("id", 1);
    expect(mockKnex.del).toHaveBeenCalled();
    expect(result).toBe(1);
  });
});
