import os
import shutil

source_dir = r"g:\artists\Anima-Style-Explorer\app\similar"

# 1. Создаем правильные папки part_0 ... part_9
for i in range(10):
    os.makedirs(os.path.join(source_dir, f"part_{i}"), exist_ok=True)

moved_count = 0

# 2. Находим все файлы (включая те, что уже лежат в part_1..part_6)
for root, dirs, files in list(os.walk(source_dir)):
    for file_name in files:
        if file_name.endswith(".js"):
            file_path = os.path.join(root, file_name)
            
            # Извлекаем ID из имени файла (например, "12345.js" -> 12345)
            item_id_str = os.path.splitext(file_name)[0]
            
            try:
                item_id = int(item_id_str)
                target_folder_index = item_id % 10
                
                target_dir = os.path.join(source_dir, f"part_{target_folder_index}")
                target_path = os.path.join(target_dir, file_name)
                
                # Перемещаем файл в правильную папку
                if os.path.abspath(file_path) != os.path.abspath(target_path):
                    shutil.move(file_path, target_path)
                    moved_count += 1
            except ValueError:
                continue

print(f"Готово! Перераспределено по математическому ID: {moved_count} файлов.")