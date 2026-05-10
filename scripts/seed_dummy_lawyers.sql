-- SQL Script to insert 10 dummy lawyers for testing
-- Refactored to avoid 2D array slicing issues and respect triggers

DO $$
DECLARE
    new_user_id UUID;
    l_first TEXT;
    l_last TEXT;
    l_specializations TEXT[];
    l_location TEXT;
    i INTEGER;
BEGIN
    -- Temporary data table logic using a loop and CASE for variety
    FOR i IN 1..10 LOOP
        -- Define data for each iteration
        l_first := (ARRAY['John', 'Sarah', 'Michael', 'Emma', 'Robert', 'Olivia', 'David', 'Sophia', 'James', 'Isabella'])[i];
        l_last := (ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'])[i];
        l_location := (ARRAY['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA'])[i];
        
        -- Assign specializations based on index
        IF i = 1 THEN l_specializations := ARRAY['Family Law', 'Civil Law'];
        ELSIF i = 2 THEN l_specializations := ARRAY['Criminal Law', 'Civil Law'];
        ELSIF i = 3 THEN l_specializations := ARRAY['Corporate Law', 'Tax Law'];
        ELSIF i = 4 THEN l_specializations := ARRAY['Family Law', 'Real Estate Law'];
        ELSIF i = 5 THEN l_specializations := ARRAY['Intellectual Property', 'Corporate Law'];
        ELSIF i = 6 THEN l_specializations := ARRAY['Immigration Law', 'Labor Law'];
        ELSIF i = 7 THEN l_specializations := ARRAY['Real Estate Law', 'Bankruptcy Law'];
        ELSIF i = 8 THEN l_specializations := ARRAY['Criminal Law', 'Immigration Law'];
        ELSIF i = 9 THEN l_specializations := ARRAY['Family Law', 'Criminal Law'];
        ELSE l_specializations := ARRAY['Labor Law', 'Civil Law'];
        END IF;

        -- 1. Create User in auth.users (Triggers Profile and Lawyer Profile creation)
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            aud,
            confirmation_token
        ) VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            lower(l_first) || '.' || lower(l_last) || i || '@example.com', -- Added i to ensure unique email
            crypt('password123', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('first_name', l_first, 'last_name', l_last, 'user_type', 'lawyer'),
            now(),
            now(),
            'authenticated',
            'authenticated',
            ''
        ) RETURNING id INTO new_user_id;

        -- 2. Update Base Profile (Auto-created by trigger)
        UPDATE public.profiles SET
            location = l_location,
            bio = 'Experienced legal professional specializing in ' || array_to_string(l_specializations, ' and ') || '.',
            avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || l_first || i
        WHERE id = new_user_id;

        -- 3. Update Lawyer Profile (Auto-created by trigger)
        UPDATE public.lawyer_profiles SET
            specializations = l_specializations,
            hourly_rate = 150 + (random() * 200)::integer,
            success_rate = 70 + (random() * 25)::integer,
            total_cases = 10 + (random() * 50)::integer,
            average_rating = (3.5 + (random() * 1.5))::numeric(3,2),
            verified = true,
            years_of_experience = 5 + (random() * 20)::integer,
            bar_license_number = 'BAR-' || (100000 + i)
        WHERE id = new_user_id;
    END LOOP;
END $$;
