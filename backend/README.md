# MySQL Office Dashboard Backend

Node.js backend application using Express and MySQL2 with JWT authentication.

## Project Structure

```
├── server.js          # Main server file
├── db.js             # MySQL connection pool
├── routes/
│   └── auth.js       # Authentication routes
├── .env              # Environment variables
├── package.json      # Dependencies
└── README.md         # Documentation
```

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   The `.env` file is already configured with your database credentials.

3. **Start the Server**
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication

#### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name",
    "role": "admin"
  }
}
```

**Error Responses:**
- `400` - Missing email or password
- `401` - Invalid credentials
- `500` - Server error

### Health Check

#### GET /health
Check if server is running.

**Response (200):**
```json
{
  "status": "Server is running",
  "timestamp": "2026-02-25T..."
}
```

## Environment Variables

- `DB_HOST` - MySQL host address
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `PORT` - Server port (default: 5000)
- `JWT_SECRET` - Secret key for JWT tokens

## Notes

- JWT tokens expire after 8 hours
- Make sure your MySQL `users` table has columns: `id`, `email`, `password`, `name`, `role`
- Password comparison is currently plain text. For production, implement bcrypt hashing.

## Security Recommendations

1. Change `JWT_SECRET` to a strong random string
2. Implement password hashing with bcrypt
3. Add rate limiting for login attempts
4. Use HTTPS in production
5. Never commit `.env` file to version control
