import os
import sys
from huggingface_hub import HfApi

api = HfApi()

base_folder = r"g:\artists\Anima-Style-Explorer\similar"
repo_id = "Kellenok/anima"
repo_type = "dataset"

print("Начинаем быструю многопоточную загрузку...")

for i in range(10):
    subfolder_name = f"part_{i}"
    local_subfolder = os.path.join(base_folder, subfolder_name)
    
    if os.path.exists(local_subfolder):
        print(f"\n[Загрузка {i+1}/10] Загружаем папку {subfolder_name}...")
        try:
            api.upload_folder(
                folder_path=local_subfolder,
                path_in_repo=f"similar/{subfolder_name}",
                repo_id=repo_id,
                repo_type=repo_type,
                commit_message=f"Upload similar artists data {subfolder_name}",
                num_workers=16  # <--- МНОГОПОТОЧНОСТЬ (16 файлов одновременно)
            )
            print(f"✓ Папка {subfolder_name} успешно загружена!")
        except Exception as e:
            print(f"✗ Ошибка при загрузке {subfolder_name}: {e}")

print("\n🎉 ВСЕ ПАПКИ УСПЕШНО ЗАГРУЖЕНЫ!")