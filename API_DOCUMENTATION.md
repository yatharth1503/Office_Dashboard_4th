# API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 1. Authentication Endpoints

### POST /api/auth/login
Login and get JWT token.

**Request Body:**
```json
{
  "email": "raj.t@coronation.in",
  "password": "eSZHb$#@tUJ$"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "raj.t@coronation.in",
    "name": "Raj Trivedi",
    "role": "admin"
  }
}
```

**Errors:**
- `400` - Missing email or password
- `401` - Invalid credentials

---

## 2. Activity Types Endpoints

### GET /api/activity-types
Get all activity types (Protected).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Meeting",
      "created_at": "2026-02-25T10:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Development",
      "created_at": "2026-02-25T10:00:00.000Z"
    }
  ]
}
```

---

## 3. DAR (Daily Activity Report) Endpoints

### POST /api/dar
Create DAR with activities (Protected).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "date": "2026-02-25",
  "activities": [
    {
      "activity_type_id": 1,
      "message": "Team standup meeting",
      "minutes": 30,
      "remarks": "Discussed sprint goals"
    },
    {
      "activity_type_id": 2,
      "message": "Implemented login API",
      "minutes": 180,
      "remarks": "Completed with JWT authentication"
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "DAR created successfully",
  "data": {
    "dar_id": 1,
    "user_id": 5,
    "date": "2026-02-25",
    "total_minutes": 210,
    "activities_count": 2
  }
}
```

**Errors:**
- `400` - Missing or invalid data
- `401` - Unauthorized

### GET /api/dar
Get DAR entries for logged-in user (Protected).

**Query Parameters:**
- `date` - Specific date (YYYY-MM-DD)
- `from_date` & `to_date` - Date range

**Examples:**
```
GET /api/dar?date=2026-02-25
GET /api/dar?from_date=2026-02-01&to_date=2026-02-28
GET /api/dar (all entries)
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "date": "2026-02-25",
      "total_minutes": 210,
      "created_at": "2026-02-25T10:30:00.000Z",
      "user_name": "Yatharth Shah",
      "user_email": "yatharth.s@coronation.in",
      "activities": [
        {
          "id": 1,
          "activity_type_id": 1,
          "activity_type_name": "Meeting",
          "message": "Team standup meeting",
          "minutes": 30,
          "remarks": "Discussed sprint goals"
        }
      ]
    }
  ]
}
```

---

## 4. Leaves Endpoints

### POST /api/leaves
Apply for leave (Protected).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "from_date": "2026-03-01",
  "to_date": "2026-03-03",
  "reason": "Family function"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Leave application submitted successfully",
  "data": {
    "id": 1,
    "user_id": 5,
    "from_date": "2026-03-01",
    "to_date": "2026-03-03",
    "reason": "Family function",
    "status": "pending"
  }
}
```

**Errors:**
- `400` - Missing dates or invalid date range
- `401` - Unauthorized

### GET /api/leaves
Get leave history for logged-in user (Protected).

**Query Parameters:**
- `status` - Filter by status (pending/approved/rejected)

**Example:**
```
GET /api/leaves?status=pending
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "from_date": "2026-03-01",
      "to_date": "2026-03-03",
      "reason": "Family function",
      "status": "pending",
      "created_at": "2026-02-25T10:00:00.000Z",
      "user_name": "Yatharth Shah",
      "user_email": "yatharth.s@coronation.in"
    }
  ]
}
```

### GET /api/leaves/all
Get all leaves - Admin only (Protected).

**Query Parameters:**
- `status` - Filter by status
- `user_id` - Filter by user

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 5,
      "from_date": "2026-03-01",
      "to_date": "2026-03-03",
      "reason": "Family function",
      "status": "pending",
      "created_at": "2026-02-25T10:00:00.000Z",
      "user_name": "Yatharth Shah",
      "user_email": "yatharth.s@coronation.in"
    }
  ]
}
```

**Errors:**
- `403` - Access denied (not admin)

### PATCH /api/leaves/:id/status
Update leave status - Admin only (Protected).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "approved"
}
```

**Valid statuses:** `pending`, `approved`, `rejected`

**Response (200):**
```json
{
  "success": true,
  "message": "Leave approved successfully"
}
```

**Errors:**
- `400` - Invalid status
- `403` - Access denied (not admin)
- `404` - Leave not found

---

## Error Responses

All endpoints may return these errors:

**401 Unauthorized:**
```json
{
  "error": "Access denied. No token provided."
}
```

**500 Internal Server Error:**
```json
{
  "error": "An error occurred..."
}
```

---

## Testing with cURL

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"raj.t@coronation.in","password":"eSZHb$#@tUJ$"}'
```

**Get Activity Types:**
```bash
curl -X GET http://localhost:5000/api/activity-types \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Create DAR:**
```bash
curl -X POST http://localhost:5000/api/dar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-02-25",
    "activities": [
      {
        "activity_type_id": 1,
        "message": "Meeting",
        "minutes": 30
      }
    ]
  }'
```

**Apply Leave:**
```bash
curl -X POST http://localhost:5000/api/leaves \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from_date": "2026-03-01",
    "to_date": "2026-03-03",
    "reason": "Vacation"
  }'
```
