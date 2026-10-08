# EduPulse Student Analytics

## Run the dashboard

Install Node.js, then run:

```sh
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The dashboard loads and saves its student dataset through the local backend. Data is stored in `data/students.json` and remains available after restarting the server.

The backend provides:

- `GET /api/health` — server health
- `GET /api/students` — load the saved CSV rows
- `PUT /api/students` — replace saved rows with `{ "students": [...] }`
- `DELETE /api/students` — clear the saved rows
