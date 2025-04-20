# 🌊 WILMA – Water Infrastructure Lifecycle Management App

A full-stack web application for managing water usage, users, and system infrastructure efficiently.

---

## 🚀 Tech Stack

| Layer        | Tech Used                          |
|--------------|------------------------------------|
| Frontend     | React + TypeScript + Vite          |
| Styling      | CSS Modules, Tailwind (optional)   |
| Backend      | ASP.NET Core (C#)                  |
| Auth         | JWT + Refresh Tokens               |
| DB           | SQLite (via EF Core)               |
| Email        | MailKit (SMTP reset, etc.)         |

---

## 🔐 Features

- ✅ User Login / Register / Role-based access (Admin/User)
- ✅ JWT Access Token + Refresh Token handling
- ✅ Profile image upload & profile editing
- ✅ Password reset with token email link
- ✅ Live online-status tracking
- ✅ Secure input validation + basic XSS protection
- ✅ Token auto-refresh with Axios interceptor

---

## 🛠️ Setup Guide

### 📦 Install Dependencies

```bash
# Frontend
cd DPA
npm install

# Backend
cd ../WILMA_Backend
dotnet restore
