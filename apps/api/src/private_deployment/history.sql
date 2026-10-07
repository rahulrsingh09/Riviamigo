REVOKE DELETE, TRUNCATE ON
    riviamigo.vehicles,
    riviamigo.trips,
    timeseries.telemetry,
    riviamigo.vehicle_state_periods,
    riviamigo.software_versions,
    riviamigo.battery_capacity_snapshots
FROM CURRENT_USER;

-- Charging repair merges duplicate sessions into a durable canonical session.
REVOKE TRUNCATE ON riviamigo.charge_sessions FROM CURRENT_USER;

SELECT alter_job(job_id, scheduled => false)
FROM timescaledb_information.jobs
WHERE proc_name = 'policy_retention'
  AND scheduled
  AND (
      (hypertable_schema = 'timeseries' AND hypertable_name = 'telemetry')
      OR (hypertable_schema = 'riviamigo' AND hypertable_name IN (
          'trips', 'charge_sessions', 'rivian_charge_payloads'
      ))
  );
