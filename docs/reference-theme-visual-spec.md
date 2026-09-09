# Đặc tả trực quan 10 giao diện tham chiếu

Tài liệu này khóa mapping và các quyết định bố cục rút ra từ mười ảnh nguồn. Nội
dung nghiệp vụ (người dùng, ví, đơn hàng, dịch vụ, panel, giao dịch và thông báo)
vẫn do API cung cấp; ảnh chỉ quyết định hệ thống thị giác và composition.

## Mapping bắt buộc

| Ảnh                | Theme                 |
| ------------------ | --------------------- |
| Reference Image 01 | `SOFT_BEIGE_PREMIUM`  |
| Reference Image 02 | `JAPANESE_ZEN`        |
| Reference Image 03 | `DARK_LUXURY`         |
| Reference Image 04 | `PREMIUM_CORPORATE`   |
| Reference Image 05 | `CYBER_NEON`          |
| Reference Image 06 | `GLASSMORPHISM`       |
| Reference Image 07 | `EMERALD_BUSINESS`    |
| Reference Image 08 | `SOCIAL_CREATOR`      |
| Reference Image 09 | `EDITORIAL_BRUTALIST` |
| Reference Image 10 | `AI_FUTURISTIC`       |

## Phân tích từng hệ thống

### 01 — SOFT_BEIGE_PREMIUM

- **Architecture:** landing chia 55/45 với editorial copy bên trái và lifestyle
  stage bên phải; auth là khối kem + ảnh kiến trúc; dashboard là canvas sáng có
  sidebar và bảng đơn hàng. Header ngang, mảnh và nằm trong khung.
- **Cards/type/spacing:** card dịch vụ đều sáu cột, serif tương phản cho heading,
  sans-serif cho dữ liệu; khoảng trắng rộng 32–64px; radius 8–12px; viền nâu mảnh,
  shadow mềm và thấp.
- **Color/background:** ivory, champagne, đá travertine và nâu espresso; nền có
  vòm kiến trúc và texture giấy/đá nhẹ. CTA chính tối, CTA phụ viền.
- **Form/table/widgets/icons:** form trắng kem chia cột rõ; KPI bốn ô nhỏ; table
  hàng mảnh; icon nét tối hoặc huy hiệu vàng, không dùng icon neon.
- **Mobile:** bỏ visual phụ trước, hero thành một cột, KPI 2×2 rồi 1 cột, bảng có
  vùng cuộn riêng và nút giữ chiều cao tối thiểu 44px.

### 02 — JAPANESE_ZEN

- **Architecture:** header tối giản dưới masthead; hero bất đối xứng với văn bản,
  sân vườn và kiến trúc shoji; auth form bên trái/cửa sổ tròn bên phải; dashboard
  như sổ vận hành với sidebar hẹp.
- **Cards/type/spacing:** service/benefit là bốn ô thấp, serif Nhật-biên-tập cho
  heading, sans condensed cho số; nhịp 24–56px; radius 2–4px; gần như không shadow.
- **Color/background:** washi, charcoal, pine green; mực loang/núi và tre tạo lớp
  nền. Button xanh thông trầm, trạng thái active như con dấu.
- **Form/table/widgets/icons:** form phẳng viền xanh xám; KPI như thẻ giấy; bảng
  kẻ mảnh; icon line-art lá, đá, torii.
- **Mobile:** ẩn phong cảnh lớn, giữ dải nhãn dọc làm accent; sidebar chuyển drawer;
  cards xếp một cột và không dùng fixed positioning.

### 03 — DARK_LUXURY

- **Architecture:** toàn trang trong khung đen-vàng; hero 50/50 với tượng đài vương
  miện; auth là suite hai cột nhìn ra skyline; dashboard console tối, sidebar trái.
- **Cards/type/spacing:** card bốn cột, heading serif display lớn, label uppercase
  letter-spaced; nhịp 20–48px; radius 8–10px; viền vàng và glow có kiểm soát.
- **Color/background:** black, obsidian, bronze, molten gold; nền núi/đá tối và các
  vòng sáng. CTA gradient vàng, CTA phụ nền đen viền vàng.
- **Form/table/widgets/icons:** input charcoal; KPI và chart phát sáng nhẹ; table
  hàng tối phân cách bằng hairline; icon kim cương/vương miện nét vàng.
- **Mobile:** giảm glow và cỡ display, visual xuống dưới copy, dashboard sidebar
  thành sheet; bảng cuộn ngang có affordance rõ.

### 04 — PREMIUM_CORPORATE

- **Architecture:** masthead thương hiệu lớn; landing dùng vòm kiến trúc, copy trái,
  nhân vật/lifestyle phải; auth panel nằm trên ảnh thành phố; dashboard sáng với
  KPI và bảng gần như full-width.
- **Cards/type/spacing:** service strip sáu thẻ cân xứng; serif premium cho tiêu đề,
  sans chuyên nghiệp cho control; nhịp 24–52px; radius 8px; shadow rất nhẹ.
- **Color/background:** cream, limestone, camel, espresso; nền vòm đá và ánh nắng.
  Button nâu đen chắc, secondary màu cát.
- **Form/table/widgets/icons:** form nhãn rõ, checkbox nhỏ; KPI icon trong vòng tròn;
  table có header kem; icon line cổ điển, đồng nhất stroke.
- **Mobile:** masthead thu gọn còn logo/menu, vòm thành background crop, service
  strip thành snap list và table giữ sticky first column.

### 05 — CYBER_NEON

- **Architecture:** khung sci-fi phát sáng; hero copy trái, nhân vật/city stage phải;
  auth terminal + city visual; dashboard telemetry với rail trái và chart chính.
- **Cards/type/spacing:** module cards viền neon, display condensed uppercase; nhịp
  16–32px; radius 6–10px; cyan/magenta outer glow nhiều tầng.
- **Color/background:** midnight navy, electric cyan, magenta, violet; nền đô thị
  tương lai và grid/perspective lines. CTA gradient hồng-cyan.
- **Form/table/widgets/icons:** input terminal tối; KPI HUD; bảng dùng row highlight;
  icon outline phát quang, không dùng emoji hệ thống.
- **Mobile:** bỏ glow lớn để tăng hiệu năng, stage crop dọc, rail thành bottom nav,
  KPI thành carousel và chart có min-width hữu hạn.

### 06 — GLASSMORPHISM

- **Architecture:** landing nổi trên city-in-the-clouds với các panel kính; hero
  và biểu tượng số 1 ở giữa; auth là glass card trước skyline; dashboard là bento
  trong suốt.
- **Cards/type/spacing:** card bo lớn 18–26px, typography serif mềm + sans rõ số;
  nhịp 24–48px; viền trắng bán trong suốt; shadow màu pastel và backdrop blur.
- **Color/background:** sky blue, pearl, lavender, pink iridescence; bubble/orb và
  cây xanh làm foreground. CTA xanh-tím-hồng.
- **Form/table/widgets/icons:** input kính mờ nhưng đạt tương phản; KPI pastel riêng;
  table trên mặt kính trắng; icon duotone mềm.
- **Mobile:** giảm blur, flatten lớp kính lồng nhau, orb không che control, bento
  về một cột và nav thành compact menu.

### 07 — EMERALD_BUSINESS

- **Architecture:** hero hàng hải với lighthouse, copy trái và biển phải; auth form
  trái/yacht top-view phải; dashboard navy full-frame với sidebar, KPI và chart.
- **Cards/type/spacing:** card dịch vụ bốn cột, serif mạnh cho heading và sans cho
  vận hành; nhịp 20–40px; radius 10–14px; viền cyan mảnh, shadow xanh sâu.
- **Color/background:** deep ocean, navy, emerald-cyan, foam white; nền sóng và
  đường chân trời. CTA cyan sáng trên nền navy.
- **Form/table/widgets/icons:** form navy trong suốt; KPI compact; table/chart grid
  xanh; icon line hàng hải (sóng, neo, khiên, đồng hồ).
- **Mobile:** lighthouse thành banner thấp, sidebar thành drawer, KPI 2×2, chart
  scroll-safe và các button full-width.

### 08 — SOCIAL_CREATOR

- **Architecture:** collage creator năng lượng cao; hero chữ trái, creator cắt lớp
  phải; auth form cạnh nhân vật; dashboard sáng với sidebar gradient và CTA strip.
- **Cards/type/spacing:** card sticker sáu cột, display black đậm + handwritten
  accents; nhịp 16–36px; radius 14–24px; shadow offset như sticker.
- **Color/background:** white, hot pink, orange, violet; brush, tape và doodle làm
  lớp nền. CTA gradient pink-orange.
- **Form/table/widgets/icons:** form trắng viền hồng; KPI nhiều màu có icon badge;
  table clean; icon social đầy màu và icon thao tác dạng sticker.
- **Mobile:** collage crop vào gương mặt nhưng không che copy, sticker trang trí bị
  ẩn, cards snap ngang, sidebar thành bottom nav.

### 09 — EDITORIAL_BRUTALIST

- **Architecture:** poster grid đen-trắng; hero typography chiếm ưu thế và khối
  concrete bên phải; auth chia white form/concrete statement; dashboard black shell.
- **Cards/type/spacing:** grid cứng, display ultra-bold condensed uppercase; nhịp
  12–28px; radius 0; border 3px; shadow offset vuông, không blur.
- **Color/background:** black, newsprint white, acid lime; texture photocopy/grain.
  Button lime hình chữ nhật, secondary đen.
- **Form/table/widgets/icons:** input viền 2px; KPI ô vuông; table high-contrast;
  icon silhouette đậm và mũi tên công nghiệp.
- **Mobile:** headline scale theo viewport, grid về một cột nhưng giữ border, poster
  statement rút gọn, table cuộn trong khung đen rõ ràng.

### 10 — AI_FUTURISTIC

- **Architecture:** hero vũ trụ với AI orb/robot, copy trái và control cards bay;
  auth neural gateway + skyline; dashboard cognitive console với AI assistant.
- **Cards/type/spacing:** HUD cards có góc cắt, display geometric + mono microcopy;
  nhịp 16–32px; radius 10–14px; blue/violet glow và inset shadow.
- **Color/background:** space navy, electric blue, cyan, violet; star field, orbital
  grid và energy rings. CTA cyan-violet luminous.
- **Form/table/widgets/icons:** input dark glass; KPI telemetry; table/chart có grid;
  icon outline holographic và trạng thái online xanh.
- **Mobile:** robot/orb thu thành visual strip, assistant thành collapsible card,
  sidebar thành bottom navigation, chart có chiều cao cố định và không tràn ngang.

## Quy tắc renderer và dữ liệu

- Admin preview gọi đúng `renderReferenceComposition` như runtime; không có bộ HTML
  demo riêng cho preview.
- Renderer chỉ thêm cấu trúc art-direction và sắp xếp vùng thật. Các component ví,
  KPI, đơn hàng, dịch vụ và form gốc vẫn giữ `id`/handler để nhận dữ liệu API.
- Structural acceptance phải kiểm tra nội dung thật bên trong các vùng, 30 hàm
  renderer độc lập, và từ chối semantic region rỗng.
