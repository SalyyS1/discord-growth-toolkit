import 'dotenv/config';
import { envFileExists, findEnvProblems, findEnvWarnings } from './config/check-env';

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

  console.error('\n  Chi tiết từng bước: mở docs/setup-guide.html\n');
  process.exit(1);
}

const warnings = findEnvWarnings();
if (warnings.length > 0) {
  console.warn('\n  Chạy được, nhưng cấu hình có điểm đáng sửa:');
  for (const warning of warnings) console.warn(`   ! ${warning}`);
  console.warn('');
}

const { boot } = await import('./app-boot');
await boot();
