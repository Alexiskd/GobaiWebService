from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse


def setUpModule():
    call_command("collectstatic", interactive=False, verbosity=0, clear=True)


class HomeViewTests(TestCase):
    def test_home_renders_iframe(self):
        response = self.client.get(reverse("game:home"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Gobai Pygame")
        self.assertContains(response, 'iframe src="/static/game/index.html"')


class GameStaticTests(TestCase):
    def test_pygbag_index_served(self):
        response = self.client.get("/static/game/index.html")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "pygbag")

    def test_pygbag_package_served(self):
        response = self.client.get("/static/game/gobai_pygame.apk")
        self.assertEqual(response.status_code, 200)
