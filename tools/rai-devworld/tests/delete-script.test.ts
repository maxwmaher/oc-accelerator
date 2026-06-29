import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('delete-rai-products script safety', () => {
  const script = fs.readFileSync(path.resolve('scripts/delete-rai-products.ps1'), 'utf8');

  it('derives product IDs from the snapshot ocId field and restricts them to RAI product IDs', () => {
    expect(script).toContain('function Get-SnapshotProductIds');
    expect(script).toContain('ForEach-Object { $_.ocId }');
    expect(script).toContain("$_ -match '^rai-devworld-product-'");
  });

  it('supports WhatIf, backs up full product JSON, and only calls the products endpoint', () => {
    expect(script).toContain('SupportsShouldProcess = $true');
    expect(script).toContain('ConvertTo-Json -Depth 50');
    expect(script).toContain('/v1/products/');
    expect(script).not.toContain('/v1/priceSchedules/');
    expect(script).not.toContain('/v1/categories/');
    expect(script).not.toContain('/v1/catalogs/');
    expect(script).not.toContain('/v1/buyers/');
  });
});
