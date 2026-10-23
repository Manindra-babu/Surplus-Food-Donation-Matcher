import datetime
from sqlalchemy.orm import Session
from .models import Restaurant, NGO, Donation, PickupRequest

def seed_database(db: Session):
    # Only seed if tables are empty
    if db.query(Restaurant).count() > 0:
        return

    restaurants = [
        Restaurant(
            id="REST-001",
            name="Green Garden Bistro",
            address="104 Elm Street, Downtown",
            contact_name="Chef Marcus Lee",
            phone="555-0199",
            cuisine_type="Mediterranean Prepared",
            is_verified=True
        ),
        Restaurant(
            id="REST-002",
            name="Artisan Bakery & Cafe",
            address="215 Oak Avenue, Midtown",
            contact_name="Sarah Jenkins",
            phone="555-0244",
            cuisine_type="Bakery & Pantry",
            is_verified=True
        ),
        Restaurant(
            id="REST-003",
            name="Harbor Harvest Kitchen",
            address="780 Shoreline Blvd",
            contact_name="Chef Kenji Sato",
            phone="555-0371",
            cuisine_type="Fresh Prepared Meals",
            is_verified=True
        ),
        Restaurant(
            id="REST-004",
            name="Verde Fresh Mexican Grill",
            address="312 Market Street",
            contact_name="Carlos Gomez",
            phone="555-0482",
            cuisine_type="Hot Prepared Mexican",
            is_verified=True
        )
    ]
    db.add_all(restaurants)
    db.commit()

    ngos = [
        NGO(
            id="NGO-001",
            name="City Hope Food Rescue",
            address="402 Harbor Ave, Dock B",
            contact_name="Elena Rostova",
            phone="555-1100",
            max_capacity_meals=150,
            current_load_meals=45,
            accepted_food_types=["hot_prepared_meals", "cold_prepared_meals", "bakery_breads", "fresh_produce"],
            pickup_radius_km=18.0,
            default_drop_off_location="Hope Distribution Center - 402 Harbor Ave, Dock B",
            is_active=True,
            status="ONLINE"
        ),
        NGO(
            id="NGO-002",
            name="Metropolitan Community Pantry",
            address="188 Central Blvd",
            contact_name="David Chen",
            phone="555-1200",
            max_capacity_meals=80,
            current_load_meals=20,
            accepted_food_types=["cold_prepared_meals", "bakery_breads", "packaged_pantry", "fresh_produce"],
            pickup_radius_km=12.0,
            default_drop_off_location="Metro Community Pantry - 188 Central Blvd, Rear Entrance",
            is_active=True,
            status="ONLINE"
        ),
        NGO(
            id="NGO-003",
            name="Southside Neighborhood Kitchen",
            address="522 9th Street, Southside",
            contact_name="Sister Patricia Murphy",
            phone="555-1300",
            max_capacity_meals=200,
            current_load_meals=170, # High load (30 meals capacity remaining)
            accepted_food_types=["hot_prepared_meals", "cold_prepared_meals"],
            pickup_radius_km=15.0,
            default_drop_off_location="Southside Community Dining Hall - 522 9th Street",
            is_active=True,
            status="ONLINE"
        ),
        NGO(
            id="NGO-004",
            name="St. Jude Family Shelter",
            address="940 East River Road",
            contact_name="Michael Vance",
            phone="555-1400",
            max_capacity_meals=50,
            current_load_meals=48, # Near capacity (2 meals capacity remaining)
            accepted_food_types=["bakery_breads", "packaged_pantry"],
            pickup_radius_km=8.0,
            default_drop_off_location="St. Jude Shelter Receiving - 940 East River Road",
            is_active=True,
            status="ONLINE"
        )
    ]
    db.add_all(ngos)
    db.commit()

    now = datetime.datetime.utcnow()

    # Initial seeded demo donations
    donations = [
        Donation(
            id="DON-DEMO-01",
            restaurant_id="REST-001",
            restaurant_name="Green Garden Bistro",
            food_name="Warm Roasted Vegetable & Quinoa Bowls",
            food_type="hot_prepared_meals",
            description="Steam-packed wholesome grain bowls with roasted zucchini, bell peppers, chickpeas, and lemon tahini.",
            quantity=30,
            unit="meal_boxes",
            prepared_at=now - datetime.timedelta(minutes=45),
            pickup_deadline=now + datetime.timedelta(hours=2, minutes=30),
            pickup_address="104 Elm Street, Downtown",
            storage_temp_celsius=63.5,
            packaging_sealed=True,
            status="AWAITING_MATCH",
            created_at=now - datetime.timedelta(minutes=45)
        ),
        Donation(
            id="DON-DEMO-02",
            restaurant_id="REST-002",
            restaurant_name="Artisan Bakery & Cafe",
            food_name="Fresh Rustic Sourdough & Country Baguettes",
            food_type="bakery_breads",
            description="Assorted freshly baked artisanal bread loaves in certified food-safe kraft paper bags.",
            quantity=40,
            unit="units",
            prepared_at=now - datetime.timedelta(hours=2),
            pickup_deadline=now + datetime.timedelta(hours=5),
            pickup_address="215 Oak Avenue, Midtown",
            storage_temp_celsius=21.0,
            packaging_sealed=True,
            status="AWAITING_MATCH",
            created_at=now - datetime.timedelta(hours=2)
        ),
        Donation(
            id="DON-DEMO-03",
            restaurant_id="REST-003",
            restaurant_name="Harbor Harvest Kitchen",
            food_name="Chilled Roasted Chicken & Grain Bowls",
            food_type="cold_prepared_meals",
            description="Refrigerated individual salad and chicken boxes maintained under continuous cold chain.",
            quantity=25,
            unit="meal_boxes",
            prepared_at=now - datetime.timedelta(hours=1),
            pickup_deadline=now + datetime.timedelta(hours=4),
            pickup_address="780 Shoreline Blvd",
            storage_temp_celsius=3.6,
            packaging_sealed=True,
            status="PENDING_APPROVAL",
            created_at=now - datetime.timedelta(hours=1)
        )
    ]
    db.add_all(donations)
    db.commit()

    # Create proposed pickup for DON-DEMO-03 to showcase human approval state
    pickup_demo = PickupRequest(
        id="REQ-DEMO-01",
        donation_id="DON-DEMO-03",
        ngo_id="NGO-001",
        restaurant_id="REST-003",
        quantity=25,
        pickup_window_start=now + datetime.timedelta(minutes=30),
        pickup_window_end=now + datetime.timedelta(hours=4),
        drop_off_location="Hope Distribution Center - 402 Harbor Ave, Dock B",
        original_drop_off_location="Hope Distribution Center - 402 Harbor Ave, Dock B",
        approval_version=1,
        status="PROPOSED", # Waiting for human approval
        accepted_by_ngo=False,
        idempotency_key="IDEMP-DEMO-001",
        created_at=now - datetime.timedelta(minutes=30),
        updated_at=now - datetime.timedelta(minutes=30)
    )
    db.add(pickup_demo)
    db.commit()
