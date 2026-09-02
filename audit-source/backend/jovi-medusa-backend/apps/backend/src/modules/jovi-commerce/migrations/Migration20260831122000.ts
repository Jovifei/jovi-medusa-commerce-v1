import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260831122000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "jovi_asset" add column if not exists "rights_evidence_sha256" text not null default '';`)
    this.addSql(`alter table if exists "jovi_entitlement" add column if not exists "run_id" text not null default '';`)
    this.addSql(`alter table if exists "jovi_delivery_receipt" add column if not exists "run_id" text not null default '';`)
    this.addSql(`create table if not exists "jovi_evidence" ("id" text not null, "evidence_id" text not null, "run_id" text not null, "evidence_sha256" text not null, "payload_sha256" text not null, "kind" text check ("kind" in ('SYNTHETIC_PAYMENT', 'SYNTHETIC_RIGHTS')) not null, "source_path" text not null, "order_id" text null, "payment_collection_id" text null, "currency_code" text null, "amount" text null, "product_id" text null, "version" text null, "terms_sha256" text null, "provenance" jsonb null, "synthetic_only" boolean not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovi_evidence_pkey" primary key ("id"));`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "order_id" text null;`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "payment_collection_id" text null;`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "currency_code" text null;`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "amount" text null;`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "product_id" text null;`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "version" text null;`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "terms_sha256" text null;`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "provenance" jsonb null;`)
    this.addSql(`create unique index if not exists "IDX_jovi_evidence_evidence_id_unique" on "jovi_evidence" ("evidence_id") where deleted_at is null;`)
    this.addSql(`create table if not exists "jovi_run" ("id" text not null, "run_id" text not null, "intent_sha256" text not null, "state" text check ("state" in ('RECOVERY_PENDING', 'READY_FOR_HUMAN_DELIVERY', 'FAILED')) not null, "order_id" text not null, "payment_collection_id" text not null, "product_id" text not null, "variant_id" text not null, "environment" text check ("environment" in ('SYNTHETIC_X2')) not null, "source_fixture_sha256" text not null, "synthetic_only" boolean not null, "real_commerce_pilot_started" boolean not null, "provenance" jsonb not null, "error_code" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovi_run_pkey" primary key ("id"));`)
    this.addSql(`create unique index if not exists "IDX_jovi_run_run_id_unique" on "jovi_run" ("run_id") where deleted_at is null;`)
    this.addSql(`create unique index if not exists "IDX_jovi_entitlement_run_id_unique" on "jovi_entitlement" ("run_id") where deleted_at is null;`)
    this.addSql(`create unique index if not exists "IDX_jovi_delivery_receipt_run_id_unique" on "jovi_delivery_receipt" ("run_id") where deleted_at is null;`)
    this.addSql(`create unique index if not exists "IDX_jovi_evidence_run_kind_unique" on "jovi_evidence" ("run_id", "kind") where deleted_at is null;`)
    this.addSql(`do $$ begin alter table "jovi_asset" add constraint "CHK_jovi_asset_provenance" check ((provenance->>'environment') = 'SYNTHETIC_X2' and (provenance->>'synthetic_only')::boolean = true and (provenance->>'real_commerce_pilot_started')::boolean = false and jsonb_typeof(package_files) = 'array' and manifest_sha256 ~ '^[0-9a-f]{64}$' and rights_evidence_sha256 ~ '^[0-9a-f]{64}$'); exception when duplicate_object then null; end $$;`)
    this.addSql(`do $$ begin alter table "jovi_entitlement" add constraint "CHK_jovi_entitlement_provenance" check ((provenance->>'environment') = 'SYNTHETIC_X2' and (provenance->>'synthetic_only')::boolean = true and (provenance->>'real_commerce_pilot_started')::boolean = false and payment_evidence_sha256 ~ '^[0-9a-f]{64}$'); exception when duplicate_object then null; end $$;`)
    this.addSql(`do $$ begin alter table "jovi_delivery_receipt" add constraint "CHK_jovi_delivery_receipt_safety" check (auto_send = false and (provenance->>'environment') = 'SYNTHETIC_X2' and (provenance->>'synthetic_only')::boolean = true and (provenance->>'real_commerce_pilot_started')::boolean = false and package_manifest_sha256 ~ '^[0-9a-f]{64}$'); exception when duplicate_object then null; end $$;`)
    this.addSql(`do $$ begin alter table "jovi_evidence" add constraint "CHK_jovi_evidence_safety" check (synthetic_only = true and evidence_sha256 ~ '^[0-9a-f]{64}$' and payload_sha256 ~ '^[0-9a-f]{64}$' and source_path not like '%..%'); exception when duplicate_object then null; end $$;`)
    this.addSql(`do $$ begin alter table "jovi_run" add constraint "CHK_jovi_run_safety" check (environment = 'SYNTHETIC_X2' and synthetic_only = true and real_commerce_pilot_started = false and intent_sha256 ~ '^[0-9a-f]{64}$' and source_fixture_sha256 ~ '^[0-9a-f]{64}$'); exception when duplicate_object then null; end $$;`)
    this.addSql(`alter table if exists "jovi_run" add column if not exists "payment_snapshot_sha256" text not null default '0000000000000000000000000000000000000000000000000000000000000000';`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "evidence_key" text not null default '';`)
    this.addSql(`alter table if exists "jovi_evidence" add column if not exists "payment_snapshot_sha256" text null;`)
    this.addSql(`create unique index if not exists "IDX_jovi_run_order_id_unique" on "jovi_run" ("order_id") where deleted_at is null;`)
    this.addSql(`create unique index if not exists "IDX_jovi_run_payment_collection_id_unique" on "jovi_run" ("payment_collection_id") where deleted_at is null;`)
    this.addSql(`create unique index if not exists "IDX_jovi_evidence_evidence_key_unique" on "jovi_evidence" ("evidence_key") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "jovi_run" cascade;`)
    this.addSql(`drop table if exists "jovi_evidence" cascade;`)
    this.addSql(`alter table if exists "jovi_asset" drop column if exists "rights_evidence_sha256";`)
    this.addSql(`alter table if exists "jovi_entitlement" drop column if exists "run_id";`)
    this.addSql(`alter table if exists "jovi_delivery_receipt" drop column if exists "run_id";`)
  }
}
