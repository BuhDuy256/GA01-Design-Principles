import { jest } from "@jest/globals";

// 1. Mock Database with Transaction
const mockTrx = jest.fn((tableName) => {
    // Return a chainable object simulating knex builder
    const builder = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 99 }]),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
    };
    return builder;
});

const mockDbTransaction = jest.fn(async (callback) => {
    // Execute the callback with the mockTrx
    return await callback(mockTrx);
});

const mockDb = {
    transaction: mockDbTransaction
};
jest.unstable_mockModule("../utils/db.js", () => ({ default: mockDb }));

// 2. Mock File System
const mockFs = {
    renameSync: jest.fn()
};
jest.unstable_mockModule("fs", () => ({ default: mockFs }));

// Load the service AFTER mocking dependencies
const adminProductService = await import("../services/admin.product.service.js");

describe("AdminProductService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("createProductWithImages", () => {
        const mockProductData = {
            name: "Test Product",
            category_id: 1,
            seller_id: 2,
            current_price: 1000
        };

        test("should successfully create product, rename thumbnail and sub-images within transaction", async () => {
            const thumbnailFile = "temp_thumb.jpg";
            const subImageFiles = ["temp_1.jpg", "temp_2.jpg"];

            const result = await adminProductService.createProductWithImages(mockProductData, thumbnailFile, subImageFiles);

            // 1. Verify transaction was used
            expect(mockDb.transaction).toHaveBeenCalled();

            // 2. Verify fs.renameSync was called for thumbnail + sub images
            expect(mockFs.renameSync).toHaveBeenCalledTimes(3); 
            
            // Thumbnail physical move check
            expect(mockFs.renameSync).toHaveBeenNthCalledWith(
                1, 
                expect.stringContaining("temp_thumb.jpg"), 
                expect.stringContaining("p99_thumb.jpg")
            );

            // Sub images physical move check
            expect(mockFs.renameSync).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining("temp_1.jpg"), 
                expect.stringContaining("p99_1.jpg")
            );
            
            expect(mockFs.renameSync).toHaveBeenNthCalledWith(
                3,
                expect.stringContaining("temp_2.jpg"), 
                expect.stringContaining("p99_2.jpg")
            );

            // 3. Verify it returns the product ID
            expect(result).toBe(99); 
        });

        test("should handle creation without any images smoothly", async () => {
            const result = await adminProductService.createProductWithImages(mockProductData, null, null);
            
            expect(mockDb.transaction).toHaveBeenCalled();
            expect(mockFs.renameSync).not.toHaveBeenCalled();
            expect(result).toBe(99);
        });

        test("should throw and rollback if fs.renameSync fails", async () => {
            const thumbnailFile = "temp_thumb.jpg";
            const subImageFiles = [];

            mockFs.renameSync.mockImplementationOnce(() => {
                throw new Error("Disk Full");
            });

            await expect(
                adminProductService.createProductWithImages(mockProductData, thumbnailFile, subImageFiles)
            ).rejects.toThrow("Disk Full");

            // Transaction rolls back naturally when error is thrown inside callback
            expect(mockDb.transaction).toHaveBeenCalled();
        });
    });
});
