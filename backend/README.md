# HackDavis Backend

Python FastAPI backend for connecting the app to MongoDB Atlas.

## Setup

1. Create a virtual environment:

```sh
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```sh
pip install -r requirements.txt
```

3. Create your local environment file:

```sh
cp .env.example .env
```

4. Put your MongoDB Atlas connection string in `.env`:

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=hackdavis
```

5. Start the API:

```sh
uvicorn app.main:app --reload --host 0.0.0.0 --port 3000
```

The API will be available from the same computer at `http://localhost:3000`
and from other devices on your network at `http://YOUR_LAN_IP:3000`.

## Endpoints

- `GET /health` checks the API and MongoDB connection.
- `GET /api/events` returns saved events from MongoDB.
- `GET /api/events?lat=38.5449&lng=-121.7405&radius=25000` returns custom events near those coordinates.
- `POST /api/events` saves one event to MongoDB.

## React Native API Base

Use your computer's local network IP address when testing on a physical phone. For example:

```ts
const API_BASE = 'http://192.168.1.25:3000';
```

Use `http://localhost:3000` only when the frontend is running in the same environment as the backend, such as Expo Web in your browser.
