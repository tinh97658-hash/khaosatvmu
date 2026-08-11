# Sử dụng .NET 9 SDK để build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy các file .csproj và restore Nuget packages trước (tận dụng Docker Cache)
COPY ["API/API.csproj", "API/"]
COPY ["Application/Application.csproj", "Application/"]
COPY ["Domain/Domain.csproj", "Domain/"]
COPY ["Infrastructure/Infrastructure.csproj", "Infrastructure/"]
RUN dotnet restore "API/API.csproj"

# Copy toàn bộ mã nguồn và build
COPY . .
WORKDIR "/src"
RUN dotnet build "API/API.csproj" -c Release -o /app/build
RUN dotnet publish "API/API.csproj" -c Release -o /app/publish

# Sử dụng image Runtime .NET 9 để chạy ứng dụng
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "API.dll"]