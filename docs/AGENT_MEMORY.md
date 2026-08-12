# 🧠 Hướng Dẫn Sử Dụng AgentMemory Trong Dự Án KhaosatVMU

Dự án **KhaosatVMU** đã được tích hợp runtime bộ nhớ cục bộ **AgentMemory** (từ [agent-memory.dev](https://www.agent-memory.dev/)). 

AgentMemory cung cấp khả năng ghi nhớ siêu tốc (<20ms), lưu trữ ngữ cảnh hội thoại, triết lý thiết kế và quy tắc dự án mà không cần cài đặt các Database phức tạp (Vector DB, Redis hay Qdrant).

---

## 📌 Các Cổng (Ports) Hệ Thống

| Dịch vụ | Cổng (Port) | Mô tả |
| :--- | :--- | :--- |
| **REST API / MCP Server** | `http://localhost:3111` | Cổng API nhận truy vấn save, recall, search & MCP cho AI Agent |
| **Web Dashboard Viewer** | `http://localhost:3113` | Giao diện web trực quan xem Live Session, Search & Knowledge Graph |

---

## 🚀 Hướng Dẫn Khởi Chạy

### Cách 1: Chạy qua Docker Compose (với Profile)
```bash
docker compose --profile agentmemory up -d
```

### Cách 2: Chạy cục bộ bằng Node.js / NPX
Chạy script có sẵn trong thư mục `scripts/`:

```cmd
# Trên Windows:
scripts\start-agentmemory.cmd

# Trên Linux / macOS:
bash scripts/start-agentmemory.sh
```

---

## 🌿 Nạp Bộ Nhớ Ban Đầu (Seed Memory)

Để nạp các kiến thức quy chuẩn (Clean Architecture, Maritime UI theme, Quy trình đợt khảo sát) vào AgentMemory:

```bash
node scripts/seed-memory.js
```

---

## 🤖 Kết Nối Cấu Hình MCP Cho AI Coding Agents (VS Code, Cursor, Antigravity)

File `.vscode/mcp.json` đã được tạo tự động:

```json
{
  "mcpServers": {
    "agentmemory": {
      "command": "npx",
      "args": ["-y", "@agentmemory/mcp"],
      "env": {
        "AGENTMEMORY_URL": "http://localhost:3111"
      }
    }
  }
}
```

Các công cụ MCP Tools có sẵn: `memory_save`, `memory_recall`, `memory_smart_search`, `memory_sessions`, `governance`, `audit`...

---

## 💻 Tích Hợp Code ASP.NET Core & React

### Backend ASP.NET Core (.NET 9)
Sử dụng `IAgentMemoryService` được đăng ký sẵn trong DI:

```csharp
app.MapPost("/api/custom-endpoint", async (IAgentMemoryService memoryService) =>
{
    // Lưu bộ nhớ mới (gọi REST POST http://localhost:3111/agentmemory/remember)
    await memoryService.SaveMemoryAsync(new MemorySaveRequest("Thông tin cần nhớ", new[] { "vmu", "custom" }));

    // Truy vấn bộ nhớ (gọi REST POST http://localhost:3111/agentmemory/search)
    var results = await memoryService.RecallMemoryAsync(new MemoryRecallRequest("quy chuẩn VMU"));
    return Results.Ok(results);
});
```

### Frontend React Component
Giao diện Admin Header đã tích hợp sẵn Widget **🧠 Agent Memory** cho phép:
* Theo dõi trạng thái kết nối Realtime (Port 3111)
* Mở nhanh Dashboard Viewer (Port 3113)
* Tìm kiếm và thêm nhanh câu ghi nhớ từ giao diện Web.

File helper service: `src/Frontend/src/services/agentMemoryService.ts`.
