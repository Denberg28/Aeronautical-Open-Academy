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
                if entry['kind'] == 'quiz':
                    self.assertEqual(len(entry['options']), 4)
                    self.assertEqual(len(set(entry['options'])), 4)
                    self.assertIn(entry['correct_index'], range(4))
                elif entry['kind'] in ('activity', 'examination'):
                    self.assertIn('Rubric' if entry['kind']=='activity' else '25 points each', entry['body'])
            self.assertEqual(counts, dict(material=2,quiz=2,activity=1,examination=1))
        self.assertEqual(len(keys), 25)

    def test_handouts_match_generator_and_exclude_answer_indices(self):
        subprocess.run([sys.executable, str(ROOT/'tools/generate_samples.py'), '--check'], check=True)
        catalog = json.loads((ROOT/'app/src/main/assets/catalog.json').read_text())
        self.assertEqual([s['id'] for s in catalog['subjects']], ['a'])
        self.assertEqual(len(catalog['subjects'][0]['resources']), 5)
        self.assertNotIn('correct_index', json.dumps(catalog))
        self.assertFalse((ROOT/'app/src/main/assets/materials/b-learning-guide.pdf').exists())
        self.assertFalse((ROOT/'app/src/main/assets/materials/c-learning-guide.pdf').exists())

if __name__ == '__main__':
    unittest.main()
