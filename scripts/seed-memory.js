/**
 * Seed script to populate AgentMemory runtime with core domain knowledge of the VMU survey system.
 */
const AGENT_MEMORY_URL = process.env.AGENTMEMORY_URL || 'http://localhost:3111';

const initialMemories = [
  {
    content: "Dự án Khảo sát VMU (khaosatvmu) là hệ thống đánh giá chất lượng dạy - học thuộc Trường Đại học Hàng hải Việt Nam.",
    tags: ["vmu", "overview", "project"],
    category: "domain"
  },
  {
    content: "Hệ thống sử dụng triết lý thiết kế Maritime (Chủ đề Hàng hải) với tông màu hải quân (#0f172a, #1e293b, #38bdf8), giao diện thiết kế sắc nét vuông cạnh (no border-radius rounding).",
    tags: ["vmu", "design", "ui", "maritime"],
    category: "rules"
  },
  {
    content: "Kiến trúc hệ thống bao gồm Backend ASP.NET Core 9 (Clean Architecture: Domain, Application, Infrastructure, API), Frontend React 18 + Vite + TypeScript, và PostgreSQL 15 Database.",
    tags: ["architecture", "net9", "react", "postgres"],
    category: "tech_stack"
  },
  {
    content: "Luồng quản lý đợt khảo sát sử dụng cấu trúc cây phân cấp: Năm học (Academic Year) -> Học kỳ (Semester) -> Đợt khảo sát (Survey Campaign). Thao tác Quick-Create cho phép tạo đợt từ cây danh mục.",
    tags: ["survey", "tree", "campaign", "workflow"],
    category: "architecture"
  },
  {
    content: "AgentMemory runtime hỗ trợ 54 MCP tools và REST API tại port 3111, đi kèm giao diện trực quan Visual Viewer tại http://localhost:3113.",
    tags: ["agentmemory", "mcp", "dashboard"],
    category: "tools"
  },
  {
    content: "Quy tắc Ponytail AI Coding (repo DietrichGebert/ponytail): Áp dụng triết lý Laziest Senior Developer nhằm giảm thiểu code thừa (~54%), tiết kiệm token, giữ codebase gọn gàng và tối ưu hiệu năng.",
    tags: ["ponytail", "rules", "coding", "clean-code"],
    category: "rules"
  },
  {
    content: "Thang quyết định Ponytail (Decision Ladder 7 bước): 1. Need (YAGNI) -> 2. Codebase Reuse -> 3. Stdlib -> 4. Native Platform -> 5. Installed Dependency -> 6. One-Liner -> 7. Minimal Implementation.",
    tags: ["ponytail", "decision-ladder", "rules", "yagni"],
    category: "rules"
  },
  {
    content: "Nguyên tắc an toàn Ponytail: Tối giản code nhưng không bao giờ đánh đổi Validation, Type Safety, Security, Error Handling hay Accessibility.",
    tags: ["ponytail", "safety", "type-safety", "security"],
    category: "rules"
  }
];

async function seedMemory() {
  console.log(`🧠 Connecting to AgentMemory at ${AGENT_MEMORY_URL}...`);
  
  let successCount = 0;
  for (const item of initialMemories) {
    try {
      const res = await fetch(`${AGENT_MEMORY_URL}/agentmemory/remember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.status === 201 || res.status === 200) {
        console.log(`[OK] Saved memory: "${item.content.substring(0, 45)}..."`);
        successCount++;
      } else {
        console.warn(`[WARN] Failed to save memory (Status ${res.status}): ${item.content.substring(0, 30)}`);
      }
    } catch (err) {
      console.error(`[ERROR] Connection error to ${AGENT_MEMORY_URL}:`, err.message);
    }
  }

  console.log(`----------------------------------------------------`);
  console.log(`Seeding complete: ${successCount}/${initialMemories.length} memories indexed.`);
  if (successCount === 0) {
    console.log(`Tip: Ensure AgentMemory server is running via "npx @agentmemory/agentmemory start" or docker-compose.`);
  }
}

seedMemory();
