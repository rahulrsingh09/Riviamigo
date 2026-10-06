-- Checkpoint advancement and completion enqueueing share a transaction.
CREATE TABLE riviamigo.active_trip_checkpoints (
    vehicle_id uuid PRIMARY KEY REFERENCES riviamigo.vehicles(id) ON DELETE CASCADE,
    snapshot jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE riviamigo.pending_trip_completions (
    trip_id uuid PRIMARY KEY,
    vehicle_id uuid NOT NULL REFERENCES riviamigo.vehicles(id) ON DELETE CASCADE,
    trip jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pending_trip_completions_vehicle_idx
    ON riviamigo.pending_trip_completions(vehicle_id, created_at);

ALTER TABLE riviamigo.vehicle_runtime_state
    ADD COLUMN collector_heartbeat_at timestamptz,
    ADD COLUMN trip_persistence_error text;
