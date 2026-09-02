import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260830091019 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "jovi_entitlement" drop constraint if exists "jovi_entitlement_order_id_unique";`);
    this.addSql(`alter table if exists "jovi_entitlement" drop constraint if exists "jovi_entitlement_entitlement_id_unique";`);
    this.addSql(`alter table if exists "jovi_delivery_receipt" drop constraint if exists "jovi_delivery_receipt_entitlement_id_unique";`);
    this.addSql(`alter table if exists "jovi_delivery_receipt" drop constraint if exists "jovi_delivery_receipt_order_id_unique";`);
    this.addSql(`alter table if exists "jovi_delivery_receipt" drop constraint if exists "jovi_delivery_receipt_delivery_id_unique";`);
    this.addSql(`alter table if exists "jovi_asset" drop constraint if exists "jovi_asset_asset_id_unique";`);
    this.addSql(`create table if not exists "jovi_asset" ("id" text not null, "asset_id" text not null, "version" text not null, "rights_status" text check ("rights_status" in ('ORIGINAL', 'VERIFIED_LICENSE')) not null, "manifest_sha256" text not null, "package_files" jsonb not null, "medusa_product_id" text not null, "medusa_variant_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovi_asset_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_jovi_asset_asset_id_unique" ON "jovi_asset" ("asset_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovi_asset_deleted_at" ON "jovi_asset" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "jovi_delivery_receipt" ("id" text not null, "delivery_id" text not null, "order_id" text not null, "entitlement_id" text not null, "status" text check ("status" in ('READY_FOR_HUMAN_DELIVERY')) not null, "package_manifest_sha256" text not null, "auto_send" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovi_delivery_receipt_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_jovi_delivery_receipt_delivery_id_unique" ON "jovi_delivery_receipt" ("delivery_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_jovi_delivery_receipt_order_id_unique" ON "jovi_delivery_receipt" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_jovi_delivery_receipt_entitlement_id_unique" ON "jovi_delivery_receipt" ("entitlement_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovi_delivery_receipt_deleted_at" ON "jovi_delivery_receipt" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "jovi_entitlement" ("id" text not null, "entitlement_id" text not null, "order_id" text not null, "product_id" text not null, "version" text not null, "license_type" text check ("license_type" in ('SINGLE_USER')) not null, "terms_sha256" text not null, "issued_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "jovi_entitlement_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_jovi_entitlement_entitlement_id_unique" ON "jovi_entitlement" ("entitlement_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_jovi_entitlement_order_id_unique" ON "jovi_entitlement" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_jovi_entitlement_deleted_at" ON "jovi_entitlement" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "jovi_asset" cascade;`);

    this.addSql(`drop table if exists "jovi_delivery_receipt" cascade;`);

    this.addSql(`drop table if exists "jovi_entitlement" cascade;`);
  }

}
