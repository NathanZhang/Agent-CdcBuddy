-- Schema only; fixture values must be labelled mock.
CREATE TABLE dim_date (
        date_id TEXT PRIMARY KEY,
        year INTEGER,
        month INTEGER,
        day INTEGER,
        season TEXT
    );
CREATE TABLE dim_location (
        location_id TEXT PRIMARY KEY,
        district_code TEXT,
        province TEXT,
        city TEXT,
        district TEXT,
        street TEXT,
        address TEXT,
        latitude REAL,
        longitude REAL
    );
CREATE TABLE dim_species (
        species_id TEXT PRIMARY KEY,
        category TEXT,
        species_name TEXT,
        latin_name TEXT
    );
CREATE TABLE dim_method (
        method_id TEXT PRIMARY KEY,
        method_name TEXT
    );
CREATE TABLE dim_environment (
        environment_id TEXT PRIMARY KEY,
        environment_type TEXT
    );
CREATE TABLE dim_audit (
        audit_id TEXT PRIMARY KEY,
        audit_status TEXT,
        city_auditor TEXT,
        city_opinion TEXT,
        city_time TEXT,
        provincial_auditor TEXT,
        provincial_opinion TEXT,
        provincial_time TEXT,
        national_auditor TEXT,
        national_opinion TEXT,
        national_time TEXT
    );
CREATE TABLE dim_pathogen (
        pathogen_id TEXT PRIMARY KEY,
        pathogen_name TEXT
    );
CREATE TABLE dim_pesticide (
        pesticide_id TEXT PRIMARY KEY,
        pesticide_name TEXT,
        english_name TEXT
    );
CREATE TABLE fact_monitoring (
        monitoring_id TEXT PRIMARY KEY,
        date_id TEXT,
        location_id TEXT,
        species_id TEXT,
        method_id TEXT,
        environment_id TEXT,
        audit_id TEXT,
        capture_count INTEGER,
        female_count INTEGER,
        male_count INTEGER,
        undetermined_count INTEGER,
        larvae_count INTEGER,
        nymph_count INTEGER,
        adult_count INTEGER,
        weather_temp REAL,
        weather_humidity REAL,
        weather_wind TEXT,
        weather_condition TEXT,
        sampling_unit INTEGER,
        remarks TEXT,
        source_file TEXT,
        FOREIGN KEY(date_id) REFERENCES dim_date(date_id),
        FOREIGN KEY(location_id) REFERENCES dim_location(location_id),
        FOREIGN KEY(species_id) REFERENCES dim_species(species_id),
        FOREIGN KEY(method_id) REFERENCES dim_method(method_id),
        FOREIGN KEY(environment_id) REFERENCES dim_environment(environment_id),
        FOREIGN KEY(audit_id) REFERENCES dim_audit(audit_id)
    );
CREATE TABLE fact_pathogen_detection (
        detection_id TEXT PRIMARY KEY,
        monitoring_id TEXT,
        location_id TEXT,
        date_id TEXT,
        species_id TEXT,
        pathogen_id TEXT,
        pcr_result TEXT,
        cq_value REAL,
        tested_count INTEGER,
        positive_groups INTEGER,
        total_groups INTEGER,
        detection_method TEXT,
        remarks TEXT,
        source_file TEXT,
        FOREIGN KEY(monitoring_id) REFERENCES fact_monitoring(monitoring_id),
        FOREIGN KEY(location_id) REFERENCES dim_location(location_id),
        FOREIGN KEY(date_id) REFERENCES dim_date(date_id),
        FOREIGN KEY(species_id) REFERENCES dim_species(species_id),
        FOREIGN KEY(pathogen_id) REFERENCES dim_pathogen(pathogen_id)
    );
CREATE TABLE fact_insecticide_resistance (
        resistance_id TEXT PRIMARY KEY,
        species_id TEXT,
        pesticide_id TEXT,
        location_id TEXT,
        date_id TEXT,
        lc50 REAL,
        lc50_ci TEXT,
        lc95 REAL,
        lc95_ci TEXT,
        slope_b REAL,
        control_mortality REAL,
        corrected_mortality REAL,
        resistance_level TEXT,
        test_temp REAL,
        test_humidity REAL,
        source_file TEXT,
        FOREIGN KEY(species_id) REFERENCES dim_species(species_id),
        FOREIGN KEY(pesticide_id) REFERENCES dim_pesticide(pesticide_id),
        FOREIGN KEY(location_id) REFERENCES dim_location(location_id),
        FOREIGN KEY(date_id) REFERENCES dim_date(date_id)
    );
