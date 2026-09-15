<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class MonitoraRoutesTest extends TestCase
{
    public static function pages(): array
    {
        return [
            ['/', 'index.html'],
            ['/index.html', 'index.html'],
            ['/analises', 'analises.html'],
            ['/analises.html', 'analises.html'],
            ['/auth/callback', 'auth/callback.html'],
            ['/auth/callback.html', 'auth/callback.html'],
        ];
    }

    #[DataProvider('pages')]
    public function test_preserves_each_built_page_without_rewriting_its_scripts(string $url, string $file): void
    {
        $this->get($url)->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=UTF-8')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertContent(file_get_contents(resource_path('frontend/'.$file)));
    }

    public function test_callback_cannot_be_cached(): void
    {
        $response = $this->get('/auth/callback');
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $response->assertHeader('Pragma', 'no-cache');
        $response->assertDontSee('laravel_session');
    }

    public function test_unknown_paths_and_private_files_are_not_delivered(): void
    {
        foreach (['/.env', '/composer.json', '/vendor/autoload.php', '/resources/frontend/index.html', '/unknown'] as $path) {
            $this->get($path)->assertNotFound();
        }
    }

    public function test_does_not_accept_writes_to_application_pages(): void
    {
        $this->post('/analises')->assertStatus(405);
    }

    public function test_health_endpoint_is_available(): void
    {
        $this->get('/up')->assertOk();
    }
}
