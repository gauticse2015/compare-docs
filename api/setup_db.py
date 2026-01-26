from .database import create_tables

def setup():
    print("Creating database tables...")
    create_tables()
    print("Tables created successfully.")

if __name__ == "__main__":
    setup()