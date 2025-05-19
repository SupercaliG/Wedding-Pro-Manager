-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations Table (for RLS)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users Table (assuming users can belong to organizations)
CREATE TABLE users (
    id UUID PRIMARY KEY, -- Corresponds to auth.users.id
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    full_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Venues Table
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parking_tips TEXT,
    permit_info TEXT,
    markdown_tips TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_venues_organization_id ON venues(organization_id);
CREATE INDEX idx_venues_name ON venues(name);
CREATE INDEX idx_venues_search ON venues USING GIN (to_tsvector('english', name || ' ' || description || ' ' || parking_tips || ' ' || permit_info || ' ' || markdown_tips));

-- Locations Table
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_locations_venue_id ON locations(venue_id);
CREATE INDEX idx_locations_organization_id ON locations(organization_id);
CREATE INDEX idx_locations_city_state ON locations(city, state_province);
CREATE INDEX idx_locations_postal_code ON locations(postal_code);

-- Tags Table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tags_organization_name UNIQUE (organization_id, name)
);

CREATE INDEX idx_tags_organization_id ON tags(organization_id);
CREATE INDEX idx_tags_name ON tags(name);

-- Venue_Tags Table
CREATE TABLE venue_tags (
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (venue_id, tag_id)
);

CREATE INDEX idx_venue_tags_venue_id ON venue_tags(venue_id);
CREATE INDEX idx_venue_tags_tag_id ON venue_tags(tag_id);
CREATE INDEX idx_venue_tags_organization_id ON venue_tags(organization_id);

-- User_Pins Table
CREATE TABLE user_pins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_pins_user_venue UNIQUE (user_id, venue_id)
);

CREATE INDEX idx_user_pins_user_id ON user_pins(user_id);
CREATE INDEX idx_user_pins_venue_id ON user_pins(venue_id);
CREATE INDEX idx_user_pins_organization_id ON user_pins(organization_id);

-- Enable RLS on all tables
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pins ENABLE ROW LEVEL SECURITY;

-- Create policies for venues table
CREATE POLICY "Users can view venues from their organization" 
  ON venues FOR SELECT 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert venues into their organization" 
  ON venues FOR INSERT 
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update venues in their organization" 
  ON venues FOR UPDATE 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete venues in their organization" 
  ON venues FOR DELETE 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Create policies for locations table
CREATE POLICY "Users can view locations from their organization" 
  ON locations FOR SELECT 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert locations into their organization" 
  ON locations FOR INSERT 
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update locations in their organization" 
  ON locations FOR UPDATE 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete locations in their organization" 
  ON locations FOR DELETE 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Create policies for tags table
CREATE POLICY "Users can view tags from their organization" 
  ON tags FOR SELECT 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert tags into their organization" 
  ON tags FOR INSERT 
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update tags in their organization" 
  ON tags FOR UPDATE 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete tags in their organization" 
  ON tags FOR DELETE 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Create policies for venue_tags table
CREATE POLICY "Users can view venue_tags from their organization" 
  ON venue_tags FOR SELECT 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert venue_tags into their organization" 
  ON venue_tags FOR INSERT 
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete venue_tags in their organization" 
  ON venue_tags FOR DELETE 
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Create policies for user_pins table
CREATE POLICY "Users can view their own pins" 
  ON user_pins FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own pins" 
  ON user_pins FOR INSERT 
  WITH CHECK (user_id = auth.uid() AND organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete their own pins" 
  ON user_pins FOR DELETE 
  USING (user_id = auth.uid());

-- Create stored procedure for creating a venue with its location in a single transaction
CREATE OR REPLACE FUNCTION create_venue_with_location(
  venue_name TEXT,
  venue_description TEXT,
  venue_parking_tips TEXT,
  venue_permit_info TEXT,
  venue_markdown_tips TEXT,
  venue_organization_id UUID,
  venue_created_by UUID,
  location_address_line1 TEXT,
  location_address_line2 TEXT,
  location_city TEXT,
  location_state_province TEXT,
  location_postal_code TEXT,
  location_country TEXT,
  location_latitude DECIMAL(9,6),
  location_longitude DECIMAL(9,6)
) RETURNS JSONB AS $$
DECLARE
  new_venue_id UUID;
  new_location_id UUID;
  result JSONB;
BEGIN
  -- Insert venue
  INSERT INTO venues (
    name,
    description,
    parking_tips,
    permit_info,
    markdown_tips,
    organization_id,
    created_by
  ) VALUES (
    venue_name,
    venue_description,
    venue_parking_tips,
    venue_permit_info,
    venue_markdown_tips,
    venue_organization_id,
    venue_created_by
  ) RETURNING id INTO new_venue_id;
  
  -- Insert location if address data is provided
  IF location_address_line1 IS NOT NULL OR location_city IS NOT NULL THEN
    INSERT INTO locations (
      venue_id,
      organization_id,
      address_line1,
      address_line2,
      city,
      state_province,
      postal_code,
      country,
      latitude,
      longitude
    ) VALUES (
      new_venue_id,
      venue_organization_id,
      location_address_line1,
      location_address_line2,
      location_city,
      location_state_province,
      location_postal_code,
      location_country,
      location_latitude,
      location_longitude
    ) RETURNING id INTO new_location_id;
  END IF;
  
  -- Return the result
  SELECT jsonb_build_object(
    'venue_id', new_venue_id,
    'location_id', new_location_id
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create stored procedure for updating a venue with its location in a single transaction
CREATE OR REPLACE FUNCTION update_venue_with_location(
  venue_id UUID,
  venue_name TEXT,
  venue_description TEXT,
  venue_parking_tips TEXT,
  venue_permit_info TEXT,
  venue_markdown_tips TEXT,
  venue_updated_by UUID,
  location_id UUID,
  location_address_line1 TEXT,
  location_address_line2 TEXT,
  location_city TEXT,
  location_state_province TEXT,
  location_postal_code TEXT,
  location_country TEXT,
  location_latitude DECIMAL(9,6),
  location_longitude DECIMAL(9,6)
) RETURNS VOID AS $$
DECLARE
  venue_org_id UUID;
  new_location_id UUID;
BEGIN
  -- Get venue organization_id
  SELECT organization_id INTO venue_org_id FROM venues WHERE id = venue_id;
  
  -- Update venue
  UPDATE venues SET
    name = venue_name,
    description = venue_description,
    parking_tips = venue_parking_tips,
    permit_info = venue_permit_info,
    markdown_tips = venue_markdown_tips,
    updated_by = venue_updated_by,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = venue_id;
  
  -- Handle location
  IF location_id IS NOT NULL THEN
    -- Update existing location
    UPDATE locations SET
      address_line1 = location_address_line1,
      address_line2 = location_address_line2,
      city = location_city,
      state_province = location_state_province,
      postal_code = location_postal_code,
      country = location_country,
      latitude = location_latitude,
      longitude = location_longitude,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = location_id;
  ELSIF location_address_line1 IS NOT NULL OR location_city IS NOT NULL THEN
    -- Create new location
    INSERT INTO locations (
      venue_id,
      organization_id,
      address_line1,
      address_line2,
      city,
      state_province,
      postal_code,
      country,
      latitude,
      longitude
    ) VALUES (
      venue_id,
      venue_org_id,
      location_address_line1,
      location_address_line2,
      location_city,
      location_state_province,
      location_postal_code,
      location_country,
      location_latitude,
      location_longitude
    );
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;