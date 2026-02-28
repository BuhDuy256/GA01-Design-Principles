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
  count: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  whereNot: jest.fn().mockReturnThis(),
};

const dbFn = jest.fn(() => mockKnex);
jest.unstable_mockModule("../utils/db.js", () => ({ default: dbFn }));

const categoryModel = await import("../models/category.model.js");

describe("Unit Tests: category.model.js (Admin - Flow 8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("UT-ADM-CAT-01: findAll() should return all categories with product counts", async () => {
    mockKnex.orderBy.mockReturnValueOnce(mockKnex).mockResolvedValueOnce([{ id: 1, name: "Category 1" }]);

    const result = await categoryModel.findAll();

    expect(dbFn).toHaveBeenCalledWith("categories as c");
    expect(mockKnex.leftJoin).toHaveBeenCalledWith("categories as parent", "c.parent_id", "parent.id");
    expect(mockKnex.select).toHaveBeenCalled();
    expect(mockKnex.count).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1, name: "Category 1" }]);
  });

  test("UT-ADM-CAT-02: createCategory(data) should insert a new category", async () => {
    const newCat = { name: "New Category", parent_id: null };
    mockKnex.returning.mockResolvedValueOnce([{ ...newCat, id: 2 }]);

    const result = await categoryModel.createCategory(newCat);

    expect(dbFn).toHaveBeenCalledWith("categories");
    expect(mockKnex.insert).toHaveBeenCalledWith(newCat);
    expect(result).toEqual([{ ...newCat, id: 2 }]);
  });

  test("UT-ADM-CAT-03: updateCategory(id, data) should update an existing category", async () => {
    const updateData = { name: "Updated Category" };
    mockKnex.returning.mockResolvedValueOnce([{ id: 1, ...updateData }]);

    const result = await categoryModel.updateCategory(1, updateData);

    expect(dbFn).toHaveBeenCalledWith("categories");
    expect(mockKnex.where).toHaveBeenCalledWith("id", 1);
    expect(mockKnex.update).toHaveBeenCalledWith(updateData);
    expect(result).toEqual([{ id: 1, ...updateData }]);
  });

  test("UT-ADM-CAT-04: deleteCategory(id) should remove a category", async () => {
    mockKnex.del.mockResolvedValueOnce(1);

    const result = await categoryModel.deleteCategory(1);

    expect(dbFn).toHaveBeenCalledWith("categories");
    expect(mockKnex.where).toHaveBeenCalledWith("id", 1);
    expect(mockKnex.del).toHaveBeenCalled();
    expect(result).toBe(1);
  });
});
