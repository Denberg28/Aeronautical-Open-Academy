"""Content acceptance: one canonical course, balanced assessments, reproducible handouts."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]

class SubjectTemplateChecks(unittest.TestCase):
    def test_balanced_periods_and_assessment_contract(self):
        subject = json.loads((ROOT/'app/src/main/assets/subject-template.json').read_text())
        self.assertEqual([p['name'] for p in subject['periods']], ['Prelim','Midterm','Semifinals','Finals'])
        keys = {subject['overview']['key']}
        for period in subject['periods']:
            counts = dict(material=0, quiz=0, activity=0, examination=0)
            for entry in period['entries']:
                self.assertNotIn(entry['key'], keys)
                keys.add(entry['key'])
                self.assertTrue(entry['title'].startswith(period['name']))
                self.assertTrue(entry['published'])
                self.assertTrue(entry['body'].strip())
                counts[entry['kind']] += 1
                if entry['kind'] != 'material':
                    self.assertEqual(len(entry['questions']), 1 if entry['kind']=='quiz' else 4)
                    for question in entry['questions']:
                        self.assertEqual(len(question['options']), 4)
                        self.assertEqual(len(set(question['options'])), 4)
                        self.assertIn(question['correct_index'], range(4))
            self.assertEqual(counts, dict(material=2,quiz=2,activity=1,examination=1))
        self.assertEqual(len(keys), 25)

    def test_handouts_match_generator_and_exclude_answer_indices(self):
        subprocess.run([sys.executable, str(ROOT/'tools/generate_samples.py'), '--check'], check=True)
        catalog = json.loads((ROOT/'app/src/main/assets/catalog.json').read_text())
        self.assertEqual([s['id'] for s in catalog['subjects']], ['a'])
        self.assertEqual(len(catalog['subjects'][0]['resources']), 5)
        self.assertNotIn('correct_index', json.dumps(catalog))
        subject = json.loads((ROOT/'app/src/main/assets/subject-template.json').read_text())
        exported = '\n'.join(r['text'] for r in catalog['subjects'][0]['resources'])
        for period in subject['periods']:
            for entry in period['entries']:
                for question in entry.get('questions', []):
                    self.assertNotIn(question['prompt'], exported)
        self.assertFalse((ROOT/'app/src/main/assets/materials/b-learning-guide.pdf').exists())
        self.assertFalse((ROOT/'app/src/main/assets/materials/c-learning-guide.pdf').exists())

if __name__ == '__main__':
    unittest.main()
