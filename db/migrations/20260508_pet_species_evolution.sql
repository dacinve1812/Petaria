-- Tiến hóa: yêu cầu cấp + vật phẩm (tùy chọn). Backend cũng gọi ensurePetSpeciesEvolutionColumns() khi khởi động.
ALTER TABLE pet_species
  ADD COLUMN evolve_min_level INT NOT NULL DEFAULT 1;

ALTER TABLE pet_species
  ADD COLUMN evolve_item_id INT NULL;
