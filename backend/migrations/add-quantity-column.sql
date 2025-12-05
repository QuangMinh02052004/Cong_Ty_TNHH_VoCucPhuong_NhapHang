-- ================================================================
-- Migration: Add quantity column to Products table
-- Date: 2025-12-05
-- Description: Thêm cột số lượng hàng để ghi chi tiết (VD: "2 thùng + 2 bao")
-- ================================================================

USE VoCucPhuong_NhapHang;
GO

-- Kiểm tra xem cột đã tồn tại chưa
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'Products')
    AND name = 'quantity'
)
BEGIN
    -- Thêm cột quantity (cho phép NULL, có thể để trống)
    ALTER TABLE Products
    ADD quantity NVARCHAR(500) NULL;

    PRINT '✅ Đã thêm cột quantity vào bảng Products';
END
ELSE
BEGIN
    PRINT '⚠️ Cột quantity đã tồn tại, bỏ qua';
END
GO

-- Cập nhật dữ liệu cũ (optional - chuyển từ productType sang quantity)
-- Uncomment nếu muốn migrate dữ liệu cũ
/*
UPDATE Products
SET quantity = productType
WHERE quantity IS NULL AND productType IS NOT NULL;
GO
*/

-- Xem kết quả
SELECT TOP 5
    id,
    productType,
    quantity,
    receiverName,
    createdAt
FROM Products
ORDER BY createdAt DESC;
GO

PRINT '✅ Migration hoàn tất!';
GO
