import json
import os
import time

def main():
    json_path = 'app/similar.json'
    output_dir = 'app/similar'

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"Loading {json_path}...")
    start_time = time.time()
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"Loaded {len(data)} items in {time.time() - start_time:.2f} seconds.")

    print(f"Splitting into individual .js files in {output_dir}/...")
    count = 0
    
    for artist_id, similar_ids in data.items():
        out_file = os.path.join(output_dir, f"{artist_id}.js")
        content = f'window.handleSimilarData("{artist_id}", {json.dumps(similar_ids)});'
        
        with open(out_file, 'w', encoding='utf-8') as f:
            f.write(content)
            
        count += 1
        if count % 10000 == 0:
            print(f"Wrote {count} files...")

    total_time = time.time() - start_time
    print(f"Done! Wrote {count} files to {output_dir}/ in {total_time:.2f} seconds.")

if __name__ == '__main__':
    main()
