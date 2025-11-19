// Migration Script - Cập nhật senderStation cho products cũ
import {
    getAllProducts,
    updateProduct
} from './firebase-db.js';

// Migration: Thêm senderStation cho products cũ dựa vào logic suy luận
export async function migrateSenderStation() {
    console.log('=== BẮT ĐẦU MIGRATION ===');

    try {
        // Lấy tất cả products
        const products = await getAllProducts();
        console.log(`Tổng số products: ${products.length}`);

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const product of products) {
            // Nếu đã có senderStation, bỏ qua
            if (product.senderStation) {
                skippedCount++;
                continue;
            }

            // Logic suy luận: Dựa vào createdBy để xác định trạm gửi
            // Giả sử: Nếu employee tạo product, thì trạm gửi là trạm của employee đó
            // Nhưng vì không có thông tin employee station trong product,
            // ta sẽ set senderStation = destination station (tạm thời)

            // HOẶC: Hỏi user nhập thủ công

            // Tạm thời: Set senderStation = station (để không bị lọc bỏ)
            // User sẽ cần edit lại thủ công
            const senderStation = product.station || '';

            try {
                await updateProduct(product.id, {
                    senderStation: senderStation
                });
                updatedCount++;
                console.log(`✅ Updated product ${product.id}: senderStation = "${senderStation}"`);
            } catch (error) {
                errorCount++;
                console.error(`❌ Error updating product ${product.id}:`, error);
            }
        }

        console.log('=== KẾT QUẢ MIGRATION ===');
        console.log(`✅ Đã cập nhật: ${updatedCount} products`);
        console.log(`⏭️ Bỏ qua (đã có senderStation): ${skippedCount} products`);
        console.log(`❌ Lỗi: ${errorCount} products`);
        console.log('=========================');

        alert(`Migration hoàn tất!\nĐã cập nhật: ${updatedCount} đơn hàng\nBỏ qua: ${skippedCount} đơn hàng\nLỗi: ${errorCount} đơn hàng`);

        return {
            success: true,
            updated: updatedCount,
            skipped: skippedCount,
            errors: errorCount
        };
    } catch (error) {
        console.error('Migration failed:', error);
        alert('Migration thất bại! Xem console để biết chi tiết.');
        return {
            success: false,
            error: error.message
        };
    }
}

// Export để có thể gọi từ console
window.migrateSenderStation = migrateSenderStation;
