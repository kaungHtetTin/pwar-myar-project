<?php

namespace Tests\Feature;

use Tests\TestCase;

class LegacyClientRedirectTest extends TestCase
{
    public function test_old_client_entries_preserve_their_paths_and_queries(): void
    {
        config()->set('clients.web_url', null);
        config()->set('clients.mobile_url', null);
        config()->set('clients.office_url', null);
        foreach (['app' => 'pos', 'mobile' => 'mobilepos', 'office' => 'office'] as $app => $host) {
            $this->get('/'.$app)->assertStatus(302)->assertRedirect('https://'.$host.'.pwarmyar.com/');
            $this->get('/'.$app.'/')->assertRedirect('https://'.$host.'.pwarmyar.com/');
            $this->get('/'.$app.'/login?source=bookmark')
                ->assertRedirect('https://'.$host.'.pwarmyar.com/login?source=bookmark');
        }
        $this->get('/mobile/sales/90/edit?source=history')
            ->assertRedirect('https://mobilepos.pwarmyar.com/sales/90/edit?source=history');
        $this->get('/mobile/customers/Alice%20Shop?source=history')
            ->assertRedirect('https://mobilepos.pwarmyar.com/customers/Alice%20Shop?source=history');
    }

    public function test_fallback_routes_respect_the_configured_client_url(): void
    {
        config()->set('clients.office_url', 'https://office.example.test/console/');
        $this->get('/office/login?source=old')
            ->assertRedirect('https://office.example.test/console/login?source=old');
    }
}
