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
        start = cls.html.index('<section id="as-seen-on-bet"')
        cls.feature = cls.html[start:cls.html.index('</section>', start)]
        cls.parser = Elements()
        cls.parser.feed(cls.feature)

    def test_section_is_between_hero_and_services(self):
        self.assertLess(self.html.index('class="hero"'), self.html.index('id="as-seen-on-bet"'))
        self.assertLess(self.html.index('id="as-seen-on-bet"'), self.html.index('id="ventures"'))
        self.assertEqual(self.html.count('id="as-seen-on-bet"'), 1)

    def test_accessible_heading_and_existing_sized_image(self):
        tags = self.parser.elements
        section = next(attrs for tag, attrs in tags if tag == 'section')
        heading = next(attrs for tag, attrs in tags if tag == 'h2')
        self.assertEqual(section['aria-labelledby'], heading['id'])
        image = next(attrs for tag, attrs in tags if tag == 'img')
        self.assertTrue(image['alt'])
        self.assertEqual((image['width'], image['height']), ('349', '500'))
        self.assertEqual(image['loading'], 'lazy')
        self.assertTrue((ROOT / image['src'].lstrip('/')).is_file())

    def test_verified_content_and_clear_links(self):
        self.assertIn('As seen on BET', self.feature)
        self.assertIn('Nick Cannon @ Night', self.feature)
        self.assertIn('Season 1, Episode 2', self.feature)
        self.assertIn('datetime="2026-10-27"', self.feature)
        links = [attrs['href'] for tag, attrs in self.parser.elements if tag == 'a']
        self.assertEqual(len(links), 2)
        self.assertTrue(links[0].startswith('https://tv.apple.com/us/episode/'))
        self.assertEqual(links[1], 'https://www.youtube.com/watch?v=rmPG7LjJ_CE')
        self.assertIn('Watch the series trailer', self.feature)
        self.assertNotIn('<iframe', self.feature)
        self.assertNotIn('<script', self.feature)

if __name__ == '__main__':
    unittest.main()
