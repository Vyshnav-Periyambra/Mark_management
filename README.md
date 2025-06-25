
# 🎓 Mark Management System

A simple Django-based web application for managing and displaying student marks. Ideal for educational institutions or developers learning Django.

---

## 🔧 Features

* View and manage student marks
* Organized project structure with Django templates and static files
* App-level static and template organization
* Support for environment variables using `.env`
* Easily customizable and extendable

---

## 🌐 Live Demo https://mark-management.onrender.com

Coming soon...

<!-- Or add this when live:
[🌍 Live Demo](https://your-live-demo-link.com) -->

---

## 📁 Project Structure

```
mark_management/
├── manage.py
├── mysite/
│   └── settings.py
├── marks/
│   ├── views.py
│   ├── templates/
│   │   └── myapp/
│   │       └── home.html
│   └── static/
│       └── myapp/
│           └── style.css
├── staticfiles/        # Created by collectstatic
└── db.sqlite3          # Auto-generated after migrations
```

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Vyshnav-Periyambra/mark_management.git
cd mark_management
```

### 2. Create and Activate a Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables (Optional for Development)

Create a `.env` file in the root directory:

```env
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
```

### 5. Apply Migrations and Run the Server

```bash
python manage.py migrate
python manage.py runserver
```

Open your browser and visit: [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

## ⚙️ Static Files

App-level static files are located in:

```
marks/static/
```

To collect all static files into the `staticfiles/` directory for deployment:

```bash
python manage.py collectstatic
```

---

## 📦 Requirements

* Python 3.10+ (tested with Python 3.13)
* Django 4.2+
* `python-dotenv` (for loading environment variables)

Install with:

```bash
pip install django python-dotenv
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙋‍♂️ Author

**Vyshnav Periyambra**
GitHub: [@Vyshnav-Periyambra](https://github.com/Vyshnav-Periyambra)

---
