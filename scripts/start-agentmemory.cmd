@echo off
echo Starting AgentMemory Server ^& Visual Dashboard...
echo REST API ^& MCP Server: http://localhost:3111
echo Visual Dashboard Viewer: http://localhost:3113
echo ----------------------------------------------------
set AGENTMEMORY_USE_DOCKER=1
npx -y @agentmemory/agentmemory start

