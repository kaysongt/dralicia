"""Dependency-free content/structure checks, not browser layout assertions."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class Elements(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = []

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))

class BetFeatureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / 'index.html').read_text()
        start = cls.html.index('<aside id="as-seen-on-bet"')
        cls.feature = cls.html[start:cls.html.index('</aside>', start)]
        cls.parser = Elements()
        cls.parser.feed(cls.feature)

    def test_feature_is_first_content_inside_hero(self):
        hero = self.html.index('<section class="hero">')
        feature = self.html.index('<aside id="as-seen-on-bet"')
        self.assertLess(hero, feature)
        self.assertLess(feature, self.html.index('<h1>', hero))
        self.assertLess(feature, self.html.index('</section>', hero))
        self.assertEqual(self.html.count('id="as-seen-on-bet"'), 1)
        self.assertNotIn('class="bet-feature"', self.html)

    def test_accessible_official_sized_logos(self):
        aside = next(attrs for tag, attrs in self.parser.elements if tag == 'aside')
        self.assertIn('Dr. Alicia Watkins', aside['aria-label'])
        images = [attrs for tag, attrs in self.parser.elements if tag == 'img']
        self.assertEqual([im['alt'] for im in images], ['BET', 'Nick Cannon @ Night'])
        for image in images:
            self.assertGreater(int(image['width']), 0)
            self.assertGreater(int(image['height']), 0)
            self.assertNotEqual(image.get('loading'), 'lazy')
            self.assertTrue((ROOT / image['src'].lstrip('/')).is_file())

    def test_episode_link_and_primary_booking_are_preserved(self):
        links = [attrs['href'] for tag, attrs in self.parser.elements if tag == 'a']
        self.assertEqual(len(links), 1)
        self.assertTrue(links[0].startswith('https://tv.apple.com/us/episode/'))
        self.assertIn('Dr. Alicia’s guest appearance', self.feature)
        self.assertIn('href="#appointments">Book a Consultation</a>', self.html)
        self.assertNotIn('<iframe', self.feature)
        self.assertNotIn('<script', self.feature)
        self.assertNotIn('podcast', self.feature.lower())

if __name__ == '__main__':
    unittest.main()
