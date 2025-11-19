// Dữ liệu cho các dropdown - Dễ dàng chỉnh sửa tại đây

export const OPTIONS = {
    // Danh sách các trạm nhận
    stations: [
        "00 - DỌC ĐƯỜNG",
        "01 - AN ĐÔNG",
        "02 - HÀNG XANH",
        "03 - LONG KHÁNH",
        "04 - TRẠM 97",
        "05 - XUÂN TRƯỜNG",
        "06 - SÔNG RAY",
        "07 - XUÂN LỮ",
        "08 - BẢO BÌNH",
        "09 - HAI MÃO",
        "10 - ÔNG ĐÔN",
        "11 - XUÂN ĐÀ",
        "13 - XUÂN HƯNG"
        // Thêm trạm mới ở đây
    ],

    // Danh sách loại xe (biển số xe)
    vehicles: [
        "01031",
        "01057",
        "01374",
        "01785",
        "04145",
        "04424",
        "04466",
        "04564",
        "04627",
        "04647",
        "04650",
        "04668",
        "04669",
        "04671",
        "05296",
        "05307",
        "05352",
        "05480",
        "23033",
        "23831",
        "26018",
        "26025",
        "26030",
        "26186",
        "26411",
        "26542",
        "26879",
        "27452",
        "27642",
        "27683",
        "26165",
        "50h31437",
        "50h31935",
        "50h87497",
        "04103",
        "27795",
        "49642",
        "T15026",
        "T32309"
        // Thêm biển số xe mới ở đây
    ],

    // Danh sách loại hàng
    productTypes: [
        "Nhiều loại",
        "01 - Bi thơ",
        "02 - Gói tiền",
        "03 - Thùng",
        "04 - Gói",
        "05 - Bao",
        "06 - Kiện",
        "07 - Can",
        "08 - Xô",
        "09 - Hồ sơ",
        "10 - Tủ",
        "11 - Bồ",
        "12 - Xe máy",
        "13 - Xe đạp",
        "14 - Xe mía",
        "15 - Thùng xốp",
        "16 - Giò",
        "17 - Hộp",
        "18 - VaLy",
        "19 - BalÔ",
        "20 - Nội thất",
        "21 - Điện tử",
        "22 - Máy móc",
        "23 - Nệm",
        "24 - Thực phẩm",
        "25 - Hàng dễ vỡ",
        "26 - Bao xốp",
        "27 - Gói xốp"
        // Thêm loại hàng mới ở đây
    ]
};

// Function để populate select dropdown
export function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Keep the first placeholder option
    const placeholder = select.querySelector('option[value=""]');

    // Clear existing options except placeholder
    select.innerHTML = '';
    if (placeholder) {
        select.appendChild(placeholder);
    }

    // Add new options
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
}

// Function để load tất cả options
export function loadAllOptions() {
    populateSelect('station', OPTIONS.stations);
    populateSelect('vehicle', OPTIONS.vehicles);
    populateSelect('productType', OPTIONS.productTypes);
}
