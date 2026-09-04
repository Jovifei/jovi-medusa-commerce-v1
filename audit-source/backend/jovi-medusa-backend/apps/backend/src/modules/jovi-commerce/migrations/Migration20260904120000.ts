import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260904120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "jovi_run" drop constraint if exists "jovi_run_environment_check";`)
    this.addSql(`alter table if exists "jovi_run" add constraint "jovi_run_environment_check" check ("environment" in ('SYNTHETIC_X2', 'SYNTHETIC_C2'));`)

    this.addSql(`alter table if exists "jovi_asset" drop constraint if exists "CHK_jovi_asset_provenance";`)
    this.addSql(`alter table if exists "jovi_asset" add constraint "CHK_jovi_asset_provenance" check ((provenance->>'environment') in ('SYNTHETIC_X2', 'SYNTHETIC_C2') and (provenance->>'synthetic_only')::boolean = true and (provenance->>'real_commerce_pilot_started')::boolean = false and jsonb_typeof(package_files) = 'array' and manifest_sha256 ~ '^[0-9a-f]{64}$' and rights_evidence_sha256 ~ '^[0-9a-f]{64}$');`)

    this.addSql(`alter table if exists "jovi_entitlement" drop constraint if exists "CHK_jovi_entitlement_provenance";`)
    this.addSql(`alter table if exists "jovi_entitlement" add constraint "CHK_jovi_entitlement_provenance" check ((provenance->>'environment') in ('SYNTHETIC_X2', 'SYNTHETIC_C2') and (provenance->>'synthetic_only')::boolean = true and (provenance->>'real_commerce_pilot_started')::boolean = false and payment_evidence_sha256 ~ '^[0-9a-f]{64}$');`)

    this.addSql(`alter table if exists "jovi_delivery_receipt" drop constraint if exists "CHK_jovi_delivery_receipt_safety";`)
    this.addSql(`alter table if exists "jovi_delivery_receipt" add constraint "CHK_jovi_delivery_receipt_safety" check (auto_send = false and (provenance->>'environment') in ('SYNTHETIC_X2', 'SYNTHETIC_C2') and (provenance->>'synthetic_only')::boolean = true and (provenance->>'real_commerce_pilot_started')::boolean = false and package_manifest_sha256 ~ '^[0-9a-f]{64}$');`)

    this.addSql(`alter table if exists "jovi_run" drop constraint if exists "CHK_jovi_run_safety";`)
    this.addSql(`alter table if exists "jovi_run" add constraint "CHK_jovi_run_safety" check (environment in ('SYNTHETIC_X2', 'SYNTHETIC_C2') and synthetic_only = true and real_commerce_pilot_started = false and intent_sha256 ~ '^[0-9a-f]{64}$' and source_fixture_sha256 ~ '^[0-9a-f]{64}$');`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "jovi_run" drop constraint if exists "jovi_run_environment_check";`)
    this.addSql(`alter table if exists "jovi_run" add constraint "jovi_run_environment_check" check ("environment" in ('SYNTHETIC_X2'));`)

    this.addSql(`alter table if exists "jovi_asset" drop constraint if exists "CHK_jovi_asset_provenance";`)
    this.addSql(`alter table if exists "jovi_asset" add constraint "CHK_jovi_asset_provenance" check ((provenance->>'environment') = 'SYNTHETIC_X2' and (provenance->>'synthetic_only')::boolean = true and (provenance->>'real_commerce_pilot_started')::boolean = false and jsonb_typeof(package_files) = 'array' and manifest_sha256 ~ '^[0-9a-f]{64}$' and rights_evidence_sha256 ~ '^[0-9a-f]{64}$');`)

    this.addSql(`alter table if exists "jovi_entitlement" drop constraint if exists "CHK_jovi_entitlement_provenance";`)
    this.addSql(`alter table if exists "jovi_entitlement" add constraint "CHK_jovi_entitlement_provenance" check ((provenance->>'environment') = 'SYNTHETIC_X2' and (provenance->>'synthetic_only')::boolean = true and (provenance->>'real_commerce_pilot_started')::boolean = false and payment_evidence_sha256 ~ '^[0-9a-f]{64}$');`)

    this.addSql(`alter table if exists "jovi_delivery_receipt" drop constraint if exists "CHK_jovi_delivery_receipt_safety";`)
    this.addSql(`alter table if exists "jovi_delivery_receipt" add constraint "CHK_jovi_delivery_receipt_safety" check (auto_send = false and (provenance->>'environment') = 'SYNTHETIC_X2' and (provenance->>'synthetic_only')::boolean = true and (provenance->>'real_commerce_pilot_started')::boolean = false and package_manifest_sha256 ~ '^[0-9a-f]{64}$');`)

    this.addSql(`alter table if exists "jovi_run" drop constraint if exists "CHK_jovi_run_safety";`)
    this.addSql(`alter table if exists "jovi_run" add constraint "CHK_jovi_run_safety" check (environment = 'SYNTHETIC_X2' and synthetic_only = true and real_commerce_pilot_started = false and intent_sha256 ~ '^[0-9a-f]{64}$' and source_fixture_sha256 ~ '^[0-9a-f]{64}$');`)
  }
}
