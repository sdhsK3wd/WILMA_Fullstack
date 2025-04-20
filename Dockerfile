# Use official .NET 8 SDK to build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy everything and publish
COPY . ./
WORKDIR /app/WILMA_Backend
RUN dotnet publish -c Release -o /out

# Use ASP.NET 8 runtime to run
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
ENTRYPOINT ["dotnet", "WILMA_Backend.dll"]
