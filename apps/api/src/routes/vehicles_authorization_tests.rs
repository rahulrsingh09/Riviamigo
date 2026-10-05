use super::*;
use crate::{
    authorization_test_support::Fixture,
    ingestion::session_store::{decrypt_tokens, RivianTokenBundle},
};

async fn stage(f: &Fixture, user: Uuid) -> RivianTokenBundle {
    let tokens = RivianTokenBundle {
        access_token: format!("synthetic-{user}"),
        refresh_token: "synthetic-refresh".into(),
        app_session_token: "synthetic-app".into(),
        user_session_token: "synthetic-user".into(),
        csrf_token: "synthetic-csrf".into(),
        created_at: Utc::now(),
    };
    let mut conn = f
        .state
        .redis
        .get_multiplexed_async_connection()
        .await
        .unwrap();
    store_encrypted_redis(
        &f.state,
        &mut conn,
        &format!("rivian:connect:{user}"),
        &tokens,
        60,
    )
    .await
    .unwrap();
    tokens
}

fn body(remote_id: &str) -> AddVehicleBody {
    serde_json::from_value(serde_json::json!({
        "rivian_vehicle_id": remote_id, "name": "Test vehicle"
    }))
    .unwrap()
}

fn upstream(remote_id: &str) -> Vec<RivianVehicleSummary> {
    vec![RivianVehicleSummary {
        id: remote_id.into(),
        name: Some("Test vehicle".into()),
        vin: None,
        model: Some("R1T".into()),
        model_year: Some(2026),
    }]
}

#[tokio::test]
#[ignore = "requires disposable TimescaleDB DATABASE_URL and REDIS_URL"]
async fn authorization_enrollment_rejects_forged_ids_and_upstream_failure_without_writes() {
    let f = Fixture::new().await;
    let user = f.user("user").await;
    let owner = f.user("user").await;
    f.vehicle(owner, "demo-forged-existing").await;
    let tokens = stage(&f, user).await;
    let before = f.snapshot().await;
    for remote_id in ["demo-forged-existing", "demo-forged-new"] {
        let result = add_vehicle_with_lookup(
            f.state.clone(),
            f.auth(user),
            body(remote_id),
            async |staged: &RivianTokenBundle| {
                assert_eq!(staged.access_token, tokens.access_token);
                Ok(upstream("different-vehicle"))
            },
        )
        .await;
        assert!(matches!(result, Err(AppError::Validation(_))));
        assert_eq!(f.snapshot().await, before);
    }
    let result = add_vehicle_with_lookup(
        f.state.clone(),
        f.auth(user),
        body("demo-upstream-failure"),
        async |_| Err(AppError::RivianApi("synthetic outage".into())),
    )
    .await;
    assert!(matches!(result, Err(AppError::RivianApi(_))));
    assert_eq!(f.snapshot().await, before);
    f.cleanup().await;
}

#[tokio::test]
#[ignore = "requires disposable TimescaleDB DATABASE_URL and REDIS_URL"]
async fn authorization_enrollment_cannot_hijack_existing_vehicle_or_escalate_viewer() {
    let f = Fixture::new().await;
    let owner = f.user("user").await;
    let attacker = f.user("user").await;
    let vehicle_id = f.vehicle(owner, "demo-owned").await;
    sqlx::query(
        "INSERT INTO riviamigo.vehicle_credentials (vehicle_id, encrypted_tokens)
         VALUES ($1, $2)",
    )
    .bind(vehicle_id)
    .bind(b"original-owner-credentials".as_slice())
    .execute(&f.state.pool)
    .await
    .unwrap();
    stage(&f, attacker).await;
    for viewer in [false, true] {
        if viewer {
            f.member(attacker, vehicle_id, "viewer").await;
        }
        let before = f.snapshot().await;
        let result = add_vehicle_with_lookup(
            f.state.clone(),
            f.auth(attacker),
            body("demo-owned"),
            async |_| Ok(upstream("demo-owned")),
        )
        .await;
        assert!(matches!(result, Err(AppError::Forbidden)));
        assert_eq!(f.snapshot().await, before);
    }
    f.cleanup().await;
}

#[tokio::test]
#[ignore = "requires disposable TimescaleDB DATABASE_URL and REDIS_URL"]
async fn authorization_verified_enrollment_and_existing_manager_reconnect_remain_usable() {
    let f = Fixture::new().await;
    let owner = f.user("user").await;
    let tokens = stage(&f, owner).await;
    let response = add_vehicle_with_lookup(
        f.state.clone(),
        f.auth(owner),
        body("demo-verified"),
        async |_| Ok(upstream("demo-verified")),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(response["vehicle_saved"], true);
    let vehicle_id: Uuid = serde_json::from_value(response["vehicle_id"].clone()).unwrap();
    let membership: (String, bool) = sqlx::query_as(
        "SELECT role, is_default FROM riviamigo.vehicle_memberships
         WHERE user_id = $1 AND vehicle_id = $2",
    )
    .bind(owner)
    .bind(vehicle_id)
    .fetch_one(&f.state.pool)
    .await
    .unwrap();
    assert_eq!(membership, ("owner".into(), true));
    let encrypted: Vec<u8> = sqlx::query_scalar(
        "SELECT encrypted_tokens FROM riviamigo.vehicle_credentials WHERE vehicle_id = $1",
    )
    .bind(vehicle_id)
    .fetch_one(&f.state.pool)
    .await
    .unwrap();
    assert_eq!(
        decrypt_tokens(&encrypted, &age_identity(&f.state).unwrap())
            .unwrap()
            .access_token,
        tokens.access_token
    );
    let manager = f.user("user").await;
    f.member(manager, vehicle_id, "manager").await;
    stage(&f, manager).await;
    let reconnected = add_vehicle_with_lookup(
        f.state.clone(),
        f.auth(manager),
        body("demo-verified"),
        async |_| Ok(upstream("demo-verified")),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(reconnected["vehicle_id"], response["vehicle_id"]);
    let role: String = sqlx::query_scalar(
        "SELECT role FROM riviamigo.vehicle_memberships WHERE user_id = $1 AND vehicle_id = $2",
    )
    .bind(manager)
    .bind(vehicle_id)
    .fetch_one(&f.state.pool)
    .await
    .unwrap();
    assert_eq!(role, "manager");
    assert_eq!(
        f.request(
            "GET",
            "/v1/vehicles",
            &f.token(manager),
            serde_json::Value::Null
        )
        .await
        .status(),
        axum::http::StatusCode::OK
    );
    f.cleanup().await;
}

#[tokio::test]
#[ignore = "requires disposable TimescaleDB DATABASE_URL and REDIS_URL"]
async fn authorization_enrollment_rechecks_users_after_upstream_lookup() {
    let f = Fixture::new().await;
    for delete in [false, true] {
        let user = f.user("user").await;
        stage(&f, user).await;
        let result = add_vehicle_with_lookup(
            f.state.clone(),
            f.auth(user),
            body("demo-revoked-during-lookup"),
            async |_| {
                let sql = if delete {
                    "DELETE FROM riviamigo.users WHERE id = $1"
                } else {
                    "UPDATE riviamigo.users SET is_disabled = TRUE WHERE id = $1"
                };
                sqlx::query(sql)
                    .bind(user)
                    .execute(&f.state.pool)
                    .await
                    .unwrap();
                Ok(upstream("demo-revoked-during-lookup"))
            },
        )
        .await;
        assert!(matches!(
            result,
            Err(AppError::Unauthorized | AppError::Forbidden)
        ));
        let count: i64 = sqlx::query_scalar("SELECT count(*) FROM riviamigo.vehicles")
            .fetch_one(&f.state.pool)
            .await
            .unwrap();
        assert_eq!(count, 0);
        let memberships: i64 =
            sqlx::query_scalar("SELECT count(*) FROM riviamigo.vehicle_memberships")
                .fetch_one(&f.state.pool)
                .await
                .unwrap();
        assert_eq!(memberships, 0);
    }
    f.cleanup().await;
}

#[tokio::test]
#[ignore = "requires disposable TimescaleDB DATABASE_URL and REDIS_URL"]
async fn authorization_concurrent_enrollment_creates_only_one_owner() {
    let f = Fixture::new().await;
    let first = f.user("user").await;
    let second = f.user("user").await;
    stage(&f, first).await;
    stage(&f, second).await;
    let (a, b) = tokio::join!(
        add_vehicle_with_lookup(
            f.state.clone(),
            f.auth(first),
            body("demo-race"),
            async |_| Ok(upstream("demo-race"))
        ),
        add_vehicle_with_lookup(
            f.state.clone(),
            f.auth(second),
            body("demo-race"),
            async |_| Ok(upstream("demo-race"))
        ),
    );
    assert!(matches!(
        (&a, &b),
        (Ok(_), Err(AppError::Forbidden)) | (Err(AppError::Forbidden), Ok(_))
    ));
    let owners: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM riviamigo.vehicle_memberships WHERE role = 'owner'",
    )
    .fetch_one(&f.state.pool)
    .await
    .unwrap();
    assert_eq!(owners, 1);
    let vehicles: i64 = sqlx::query_scalar("SELECT count(*) FROM riviamigo.vehicles")
        .fetch_one(&f.state.pool)
        .await
        .unwrap();
    assert_eq!(vehicles, 1);
    f.cleanup().await;
}
