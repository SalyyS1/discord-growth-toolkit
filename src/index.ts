import 'dotenv/config';
import { envFileExists, findEnvProblems } from './config/check-env';

/**
 * Cổng vào: kiểm tra cấu hình trước khi nạp phần còn lại của app, để lỗi thiếu
 * env hiện ra dạng danh sách dễ đọc thay vì stack trace.
 */
const problems = findEnvProblems();

if (problems.length > 0) {
  console.error('\n  Chưa chạy được — cấu hình còn thiếu:\n');
  for (const problem of problems) console.error(`   ✗ ${problem}`);

  if (!envFileExists()) {
    console.error('\n  Chưa có file .env. Tạo rồi điền vào:');
    console.error('     cp .env.example .env');
  }

  console.error('\n  Chi tiết từng bước: xem phần "Cài đặt" trong README.md\n');
  process.exit(1);
}

const { boot } = await import('./app-boot');
await boot();
