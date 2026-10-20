# Stage 1: Build & Publish API
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy csproj and restore dependencies (layer cache)
COPY ["WebCafe.Backend.csproj", "./"]
RUN dotnet restore "WebCafe.Backend.csproj"

# Copy full source and publish
COPY . .
RUN dotnet publish "WebCafe.Backend.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Minimal Runtime Environment
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

EXPOSE 5277
ENV ASPNETCORE_URLS=http://+:5277
ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "WebCafe.Backend.dll"]
